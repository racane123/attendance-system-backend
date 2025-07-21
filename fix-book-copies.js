import { Pool } from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function fixBookCopies() {
  try {
    console.log('🔧 Fixing book copies...')
    
    // Get all books
    const booksResult = await pool.query('SELECT id, title, total_copies, available_copies FROM books')
    console.log(`📚 Found ${booksResult.rows.length} books`)
    
    for (const book of booksResult.rows) {
      // Check if book copies exist for this book
      const copiesResult = await pool.query('SELECT COUNT(*) as count FROM book_copies WHERE book_id = $1', [book.id])
      const existingCopies = parseInt(copiesResult.rows[0].count)
      
      if (existingCopies === 0) {
        console.log(`📖 Adding copies for: ${book.title}`)
        
        // Create book copies based on total_copies or available_copies
        const copiesToCreate = book.total_copies || book.available_copies || 1
        
        for (let i = 1; i <= copiesToCreate; i++) {
          const copyQuery = `
            INSERT INTO book_copies (book_id, copy_number, barcode, status)
            VALUES ($1, $2, $3, $4)
          `
          const barcode = `${book.id}-${String(i).padStart(3, '0')}`
          const status = i <= book.available_copies ? 'available' : 'borrowed'
          
          await pool.query(copyQuery, [book.id, i, barcode, status])
        }
        
        console.log(`✅ Created ${copiesToCreate} copies for ${book.title}`)
      } else {
        console.log(`⚠️ Book copies already exist for: ${book.title} (${existingCopies} copies)`)
      }
    }
    
    console.log('🎉 Book copies fixed successfully!')
    
  } catch (error) {
    console.error('❌ Error fixing book copies:', error)
  } finally {
    await pool.end()
  }
}

fixBookCopies() 