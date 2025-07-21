import fetch from 'node-fetch';

async function testGenres() {
  try {
    const response = await fetch('http://localhost:5001/api/library/genres');
    const data = await response.json();
    console.log('Genres API Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error testing genres API:', error);
  }
}

testGenres(); 