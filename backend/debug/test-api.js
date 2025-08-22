#!/usr/bin/env node

const { default: fetch } = require('node-fetch');

async function testDocumentsAPI() {
  try {
    console.log('Testing documents API...');
    
    // First, login to get a token
    const loginResponse = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'demo@pdfsign.com',
        password: 'demo123'
      })
    });
    
    if (!loginResponse.ok) {
      console.error('Login failed:', loginResponse.status, await loginResponse.text());
      return;
    }
    
    const loginResult = await loginResponse.json();
    console.log('Login result:', loginResult);
    const token = loginResult.data.token;
    console.log('✅ Login successful');
    console.log('Token:', token);
    
    // Test documents API
    const documentsResponse = await fetch('http://localhost:4000/api/documents', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!documentsResponse.ok) {
      console.error('Documents API failed:', documentsResponse.status, await documentsResponse.text());
      return;
    }
    
    const documentsResult = await documentsResponse.json();
    console.log('✅ Documents API successful');
    console.log('Documents count:', documentsResult.data?.length || 0);
    console.log('Documents:', documentsResult.data?.map(d => `${d.originalName} (${d.status})`) || []);
    
    // Test analytics API
    const analyticsResponse = await fetch('http://localhost:4000/api/analytics/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!analyticsResponse.ok) {
      console.error('Analytics API failed:', analyticsResponse.status, await analyticsResponse.text());
      return;
    }
    
    const analyticsResult = await analyticsResponse.json();
    console.log('✅ Analytics API successful');
    console.log('Analytics data:', analyticsResult.data);
    
    // Test templates API
    const templatesResponse = await fetch('http://localhost:4000/api/templates', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!templatesResponse.ok) {
      console.error('Templates API failed:', templatesResponse.status, await templatesResponse.text());
      return;
    }
    
    const templatesResult = await templatesResponse.json();
    console.log('✅ Templates API successful');
    console.log('Templates count:', templatesResult?.length || 0);
    
  } catch (error) {
    console.error('❌ Error testing APIs:', error);
  }
}

testDocumentsAPI();
