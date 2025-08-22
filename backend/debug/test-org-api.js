#!/usr/bin/env node

const { default: fetch } = require('node-fetch');

async function testOrganizationAPI() {
  try {
    console.log('Testing organization API...');
    
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
    const token = loginResult.data.token;
    console.log('✅ Login successful');
    
    // Test current organization API
    const currentOrgResponse = await fetch('http://localhost:4000/api/organizations/current', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!currentOrgResponse.ok) {
      console.error('Current organization API failed:', currentOrgResponse.status, await currentOrgResponse.text());
      return;
    }
    
    const currentOrgResult = await currentOrgResponse.json();
    console.log('✅ Current organization API successful');
    console.log('Organization:', currentOrgResult.data?.name || 'None');
    console.log('User role:', currentOrgResult.data?.userRole || 'Unknown');
    console.log('Organization stats:', currentOrgResult.data?.stats || {});
    
  } catch (error) {
    console.error('❌ Error testing organization API:', error);
  }
}

testOrganizationAPI();
