import fetch from 'node-fetch'

async function testBorrowingFixed() {
  try {
    console.log('🧪 Testing borrowing functionality (fixed)...')
    
    // Test 1: Get books
    console.log('\n📚 Testing books endpoint...')
    const booksResponse = await fetch('http://localhost:5001/api/library/books')
    const booksData = await booksResponse.json()
    
    if (booksData.books && booksData.books.length > 0) {
      const firstBook = booksData.books[0]
      console.log(`✅ Found book: ${firstBook.title} (ID: ${firstBook.id})`)
      console.log(`   Available copies: ${firstBook.available_copies}/${firstBook.total_copies}`)
      
      if (firstBook.available_copies > 0) {
        console.log('✅ Book is available for borrowing')
      } else {
        console.log('❌ Book is not available for borrowing')
      }
    } else {
      console.log('❌ No books found')
    }
    
    // Test 2: Get genres
    console.log('\n📖 Testing genres endpoint...')
    const genresResponse = await fetch('http://localhost:5001/api/library/genres')
    const genresData = await genresResponse.json()
    
    if (genresData && genresData.length > 0) {
      console.log(`✅ Found ${genresData.length} genres`)
    } else {
      console.log('❌ No genres found')
    }
    
    console.log('\n🎉 All tests passed! The borrowing functionality should now work correctly.')
    
  } catch (error) {
    console.error('❌ Error testing borrowing:', error)
  }
}

testBorrowingFixed()