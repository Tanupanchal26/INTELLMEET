import React from 'react';
import { MessageItem } from './MessageItem';
import { clsx } from 'clsx';

interface MessageListProps {
  messages: any[]; // TODO: replace with proper ChannelMessage[] type
  userId?: string;
  isOnline?: (userId: string) => boolean;
  onReact: (msgId: string, emoji: string) => void;
  onDelete?: (msgId: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, userId, isOnline, onReact, onDelete }) => {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4 min-h-0 scrollbar-thin">
      {messages.map((msg) => (
        <MessageItem
          key={msg._id}
          msg={msg}
          userId={userId}
          isMine={msg.sender._id === userId}
          isOnline={isOnline}
          onReact={onReact}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
