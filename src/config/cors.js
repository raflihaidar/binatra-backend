export const corsOptions = {
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:5173',  // Vite dev server
        'http://localhost:3000',  // Backend dev
        'http://127.0.0.1:5173',  // Alternative localhost
        'https://binatra.id',     // Production
        'https://www.binatra.id'  // Production with www
      ]
      
      // Allow requests with no origin (Postman, mobile apps)
      if (!origin) return callback(null, true)
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`))
      }
    },
    credentials: true,  // CRUCIAL for cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Origin'
    ],
    optionsSuccessStatus: 200
  }
  