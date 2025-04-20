import mongoose, { Schema, Document } from 'mongoose';

// Define the message interface
export interface IMessage extends Document {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// Define the session interface
export interface ISession extends Document {
  sessionId: string;
  userId?: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
  isAnonymous: boolean;
  metadata?: Record<string, any>;
}

// Create the Message schema
const MessageSchema = new Schema<IMessage>({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Create the Session schema
const SessionSchema = new Schema<ISession>({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String
  },
  messages: [MessageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isAnonymous: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Create indexes for faster queries
SessionSchema.index({ sessionId: 1 });
SessionSchema.index({ userId: 1 });
SessionSchema.index({ createdAt: 1 });

// Pre-save hook to update the updatedAt field
SessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create and export the model
export const Session = mongoose.model<ISession>('Session', SessionSchema);
export const Message = mongoose.model<IMessage>('Message', MessageSchema);

export default Session; 