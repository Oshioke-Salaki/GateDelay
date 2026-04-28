import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import {
  Notification,
  NotificationChannel,
  NotificationPreferences,
} from './notification.entity';
import { SendNotificationDto, UpdatePreferencesDto } from './dto/notification.dto';
import { renderTemplate } from './notification.templates';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  // In-memory stores (swap for DB in production)
  private readonly notifications = new Map<string, Notification>();
  private readonly preferences = new Map<string, NotificationPreferences>();

  // Simple in-process queue — swap for Bull/Redis queue in production
  private readonly queue: Notification[] = [];
  private processing = false;

  constructor(private readonly config: ConfigService) {
    // Drain queue every 2 seconds
    setInterval(() => this.drainQueue(), 2000);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async send(dto: SendNotificationDto): Promise<Notification[]> {
    const prefs = this.getPrefs(dto.userId);
    const { title, body } = renderTemplate(dto.type, dto.data);

    if (prefs.optedOutTypes.includes(dto.type)) {
      this.logger.debug(`User ${dto.userId} opted out of ${dto.type}`);
      return [];
    }

    const channels = dto.channel
      ? [dto.channel]
      : this.resolveChannels(prefs);

    const created: Notification[] = channels.map((channel) => {
      const n: Notification = {
        id: uuidv4(),
        userId: dto.userId,
        type: dto.type,
        channel,
        title: dto.title ?? title,
        body: dto.body ?? body,
        data: dto.data,
        status: 'queued',
        attempts: 0,
        createdAt: new Date(),
      };
      this.notifications.set(n.id, n);
      this.queue.push(n);
      return n;
    });

    this.logger.log(`Queued ${created.length} notification(s) for user ${dto.userId}`);
    return created;
  }

  getForUser(userId: string): Notification[] {
    return [...this.notifications.values()]
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  markRead(userId: string, notificationId: string): Notification {
    const n = this.notifications.get(notificationId);
    if (!n || n.userId !== userId) throw new NotFoundException('Notification not found');
    n.status = 'read';
    n.readAt = new Date();
    return n;
  }

  getPrefs(userId: string): NotificationPreferences {
    if (!this.preferences.has(userId)) {
      this.preferences.set(userId, {
        userId,
        email: true,
        push: true,
        inApp: true,
        optedOutTypes: [],
      });
    }
    return this.preferences.get(userId)!;
  }

  updatePrefs(userId: string, dto: UpdatePreferencesDto): NotificationPreferences {
    const prefs = this.getPrefs(userId);
    if (dto.email !== undefined) prefs.email = dto.email;
    if (dto.push !== undefined) prefs.push = dto.push;
    if (dto.inApp !== undefined) prefs.inApp = dto.inApp;
    if (dto.optedOutTypes !== undefined) prefs.optedOutTypes = dto.optedOutTypes;
    if (dto.fcmToken !== undefined) prefs.fcmToken = dto.fcmToken;
    return prefs;
  }

  getMetrics(userId?: string) {
    const all = userId
      ? [...this.notifications.values()].filter((n) => n.userId === userId)
      : [...this.notifications.values()];

    return {
      total: all.length,
      queued: all.filter((n) => n.status === 'queued').length,
      sent: all.filter((n) => n.status === 'sent').length,
      failed: all.filter((n) => n.status === 'failed').length,
      read: all.filter((n) => n.status === 'read').length,
      byChannel: {
        email: all.filter((n) => n.channel === 'email').length,
        push: all.filter((n) => n.channel === 'push').length,
        'in-app': all.filter((n) => n.channel === 'in-app').length,
      },
    };
  }

  // ─── Queue Processing ───────────────────────────────────────────────────────

  private async drainQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const batch = this.queue.splice(0, 10);
    await Promise.allSettled(batch.map((n) => this.dispatch(n)));

    this.processing = false;
  }

  private async dispatch(n: Notification) {
    n.attempts++;
    try {
      if (n.channel === 'email') await this.sendEmail(n);
      else if (n.channel === 'push') await this.sendPush(n);
      // in-app: already stored in memory, no external dispatch needed
      n.status = 'sent';
      n.sentAt = new Date();
    } catch (err: any) {
      this.logger.warn(`Failed to dispatch ${n.id} via ${n.channel}: ${err.message}`);
      n.error = err.message;
      // Retry up to 3 times
      if (n.attempts < 3) {
        n.status = 'queued';
        this.queue.push(n);
      } else {
        n.status = 'failed';
      }
    }
  }

  // ─── Channel Dispatchers ────────────────────────────────────────────────────

  private async sendEmail(n: Notification) {
    const transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT', 587),
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });

    const { emailHtml } = renderTemplate(n.type, n.data);

    await transporter.sendMail({
      from: this.config.get('EMAIL_FROM', 'noreply@gatedelay.com'),
      to: n.data?.email as string | undefined,
      subject: n.title,
      html: emailHtml,
    });
  }

  private async sendPush(n: Notification) {
    // FCM via firebase-admin — initialise lazily so missing config doesn't crash the app
    const admin = await this.getFirebaseAdmin();
    if (!admin) {
      this.logger.warn('Firebase Admin not configured — skipping push');
      return;
    }

    const prefs = this.preferences.get(n.userId);
    if (!prefs?.fcmToken) {
      this.logger.debug(`No FCM token for user ${n.userId}`);
      return;
    }

    await admin.messaging().send({
      token: prefs.fcmToken,
      notification: { title: n.title, body: n.body },
      data: n.data ? Object.fromEntries(
        Object.entries(n.data).map(([k, v]) => [k, String(v)])
      ) : undefined,
    });
  }

  private firebaseAdmin: any = null;
  private async getFirebaseAdmin() {
    if (this.firebaseAdmin) return this.firebaseAdmin;
    const serviceAccountJson = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) return null;
    try {
      const admin = await import('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
        });
      }
      this.firebaseAdmin = admin;
      return admin;
    } catch {
      return null;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private resolveChannels(prefs: NotificationPreferences): NotificationChannel[] {
    const channels: NotificationChannel[] = [];
    if (prefs.email) channels.push('email');
    if (prefs.push) channels.push('push');
    if (prefs.inApp) channels.push('in-app');
    return channels.length ? channels : ['in-app'];
  }
}
