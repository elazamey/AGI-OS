import { ApiServer } from '@agi-os/api-server';

const PORT = parseInt(process.env.PORT || '3000');
const API_KEY = process.env.API_KEY || undefined;

console.log('🚀 Starting AGI-OS API Server...');
console.log(`   Port: ${PORT}`);
console.log(`   API Key: ${API_KEY ? '***' : 'None'}`);

const server = new ApiServer({
  port: PORT,
  apiKey: API_KEY,
  enableCors: true,
});

// Simulate server start
console.log('\n📡 API Routes:');
console.log('   POST /api/generate     - Generate LLM response');
console.log('   POST /api/missions     - Create mission');
console.log('   GET  /api/missions/:id - Get mission status');
console.log('   POST /api/missions/:id/start   - Start mission');
console.log('   POST /api/missions/:id/pause   - Pause mission');
console.log('   POST /api/missions/:id/complete - Complete mission');
console.log('   GET  /api/health       - Health check');

console.log('\n✅ AGI-OS API Server running on http://localhost:' + PORT);

// Test health endpoint
const healthReq = {
  method: 'GET',
  path: '/api/health',
  headers: {},
};

server.handleRequest(healthReq).then(res => {
  console.log('\n🏥 Health Check:', JSON.stringify(res.data, null, 2));
});
