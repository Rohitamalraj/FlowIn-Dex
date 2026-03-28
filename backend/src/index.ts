import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PythPriceService } from './services/pythPriceService';
import { EventIndexer } from './services/eventIndexer';
import { initializeOnChainDuelService } from './services/onChainDuelService';
import { duelRoutes } from './routes/duelRoutes';
import { priceRoutes } from './routes/priceRoutes';

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ShieldVault API',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/duels', duelRoutes);
app.use('/api/prices', priceRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Initialize services
async function initializeServices() {
  try {
    console.log('🚀 Initializing ShieldVault Backend Services...\n');

    // Initialize Pyth Price Service
    console.log('📊 Initializing Pyth Price Service...');
    const pythService = PythPriceService.getInstance();
    await pythService.initialize();
    console.log('✅ Pyth Price Service initialized\n');

    // Initialize On-Chain Duel Service
    console.log('⛓️ Initializing On-Chain Duel Service...');
    const rpcUrl = process.env.FLOW_EVM_RPC_URL || 'https://testnet.evm.nodes.onflow.org';
    const factoryAddress = process.env.FLOW_EVM_DUEL_FACTORY;
    if (!factoryAddress) {
      throw new Error('Set FLOW_EVM_DUEL_FACTORY in backend/.env');
    }
    const privateKey = process.env.FLOW_EVM_PRIVATE_KEY;

    initializeOnChainDuelService(rpcUrl, factoryAddress, privateKey);
    console.log(`✅ On-Chain Duel Service initialized (Factory: ${factoryAddress})\n`);

    const disableEventIndexer = process.env.DISABLE_EVENT_INDEXER === 'true';
    if (disableEventIndexer) {
      console.log('📡 Event Indexer disabled via DISABLE_EVENT_INDEXER=true\n');
    } else {
      // Initialize Event Indexer
      console.log('📡 Initializing Event Indexer...');
      const eventIndexer = EventIndexer.getInstance();
      await eventIndexer.start();
      console.log('✅ Event Indexer started\n');
    }

    console.log('✨ All services initialized successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    throw error;
  }
}

// Start server
async function startServer() {
  try {
    await initializeServices();

    app.listen(port, () => {
      console.log(`\n🎮 ShieldVault API Server running on port ${port}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Health check: http://localhost:${port}/health\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  const eventIndexer = EventIndexer.getInstance();
  await eventIndexer.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  const eventIndexer = EventIndexer.getInstance();
  await eventIndexer.stop();
  process.exit(0);
});

// Start the server
startServer();

export default app;
