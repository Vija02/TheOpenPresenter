import { EmbeddedPostgresManager } from './dist/index.js';

async function testEmbeddedPostgres() {
  console.log('🚀 Testing @repo/embedded-postgres package...');
  
  const pgManager = new EmbeddedPostgresManager({
    port: 7950, // Use a different port to avoid conflicts
    appDataFolderName: 'TestEmbeddedPostgres',
    databaseName: 'test_db',
    projectRoot: '../../', // Point to the workspace root where node_modules are
    extensions: {
      installPgUuidv7: true,
      extensionSourcePath: '../../tauri/node-server/script' // Path to pre-built extensions
    }
  });

  try {
    console.log('📦 Initializing PostgreSQL...');
    await pgManager.initialize();
    
    console.log('▶️  Starting PostgreSQL...');
    await pgManager.start();
    
    console.log('✅ PostgreSQL is running!');
    console.log('🔗 Connection string:', pgManager.getConnectionString());
    console.log('📊 Connection info:', pgManager.getConnectionInfo());
    console.log('🏃 Is running:', pgManager.isRunning());
    console.log('🔧 Is initialized:', pgManager.isInitialized());
    
    // Test database URLs
    const urls = pgManager.getDatabaseUrls();
    console.log('🌐 Database URLs:', urls);
    
    console.log('⏹️  Stopping PostgreSQL...');
    await pgManager.stop();
    
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testEmbeddedPostgres();