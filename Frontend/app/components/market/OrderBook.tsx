"use client";

import { useEffect, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';

interface Order {
  price: number;
  quantity: number;
  user?: string;
}

interface OrderBookProps {
  marketId: string;
  userAddress?: string;
}

export default function OrderBook({ marketId, userAddress }: OrderBookProps) {
  const [bids, setBids] = useState<Order[]>([]);
  const [asks, setAsks] = useState<Order[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Mock data for now
    const mockBids: Order[] = [
      { price: 0.95, quantity: 100, user: '0x123' },
      { price: 0.94, quantity: 200, user: '0x456' },
      { price: 0.93, quantity: 150 },
      { price: 0.92, quantity: 50 },
    ];
    const mockAsks: Order[] = [
      { price: 1.05, quantity: 120 },
      { price: 1.06, quantity: 80, user: '0x789' },
      { price: 1.07, quantity: 90 },
      { price: 1.08, quantity: 60 },
    ];
    setBids(mockBids);
    setAsks(mockAsks);

    // TODO: Connect to WebSocket
    // const newSocket = io('http://localhost:3000/prices', {
    //   auth: { token: 'user-token' }, // Get token from auth context
    // });
    // newSocket.emit('subscribe', { marketIds: [marketId] });
    // newSocket.on('orderBookUpdate', (data) => {
    //   if (data.marketId === marketId) {
    //     setBids(data.bids);
    //     setAsks(data.asks);
    //   }
    // });
    // setSocket(newSocket);

    // return () => {
    //   newSocket?.disconnect();
    // };
  }, [marketId]);

  const depthData = useMemo(() => {
    const bidDepth = bids
      .sort((a, b) => b.price - a.price)
      .reduce((acc, order, index) => {
        const cumulative = (acc[index - 1]?.cumulative || 0) + order.quantity;
        acc.push({ price: order.price, quantity: order.quantity, cumulative, type: 'bid' });
        return acc;
      }, [] as { price: number; quantity: number; cumulative: number; type: string }[]);

    const askDepth = asks
      .sort((a, b) => a.price - b.price)
      .reduce((acc, order, index) => {
        const cumulative = (acc[index - 1]?.cumulative || 0) + order.quantity;
        acc.push({ price: order.price, quantity: order.quantity, cumulative, type: 'ask' });
        return acc;
      }, [] as { price: number; quantity: number; cumulative: number; type: string }[]);

    return [...bidDepth.reverse(), ...askDepth];
  }, [bids, asks]);

  const maxQuantity = Math.max(
    ...bids.map(b => b.quantity),
    ...asks.map(a => a.quantity)
  );

  const renderOrderTable = (orders: Order[], isBid: boolean) => (
    <div className="flex-1">
      <h3 className={`text-lg font-semibold mb-2 ${isBid ? 'text-green-600' : 'text-red-600'}`}>
        {isBid ? 'Bids (Buy)' : 'Asks (Sell)'}
      </h3>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {orders.map((order, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-2 rounded ${
              order.user === userAddress ? 'bg-blue-100 border border-blue-300' : 'bg-gray-50'
            }`}
          >
            <span className="font-mono text-sm">{order.price.toFixed(4)}</span>
            <span className="font-mono text-sm">{order.quantity}</span>
            <div className="flex-1 mx-2 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${isBid ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${(order.quantity / maxQuantity) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Order Book</h2>
      <div className="flex space-x-4 mb-4">
        {renderOrderTable(bids.sort((a, b) => b.price - a.price), true)}
        {renderOrderTable(asks.sort((a, b) => a.price - b.price), false)}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={depthData}>
            <XAxis dataKey="price" />
            <YAxis />
            <Bar dataKey="cumulative">
              {depthData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.type === 'bid' ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}