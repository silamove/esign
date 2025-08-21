const database = require('../models/database');

async function checkDocuments() {
  try {
    await database.initialize();
    console.log('📊 Current database contents:');
    
    const users = await database.all('SELECT id, email FROM users');
    console.log('Users:', users);
    
    for (const user of users) {
      const docs = await database.all('SELECT id, original_name, status FROM documents WHERE user_id = ?', [user.id]);
      console.log(`Documents for ${user.email} (ID: ${user.id}):`, docs.length);
      docs.forEach(doc => console.log(`  - ${doc.original_name} (${doc.status})`));
    }
    
    const templates = await database.all('SELECT * FROM envelope_templates');
    console.log('Templates:', templates.length);
    
    await database.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDocuments();
