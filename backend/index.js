const express = require('express'); // Каркас сервера
const { Pool } = require('pg');    // Драйвер для связи с PostgreSQL
const cors = require('cors');       // Разрешалка для запросов с фронта
require('dotenv').config();         // Читалка файла .env

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors({
  origin: "*", // Разрешить запросы ототовсюду на время тестов
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type"]
}));         // Чтобы фронтенд мог достучаться до бэкенда
app.use(express.json());   // Чтобы сервер понимал формат JSON в запросах





const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Берем ту длинную ссылку из .env
  ssl: {
    rejectUnauthorized: false // Обязательно для облачных баз типа Neon
  }
});

// Добавь это сразу после создания pool
pool.on('error', (err) => {
  console.error('Неожиданная ошибка в пуле базы данных!', err);
});


// Проверка связи
app.get('/api/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()'); // Просто спрашиваем у базы время
    res.json({ message: "База на связи!", time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка подключения к базе" });
  }
});

app.delete('/api/bookings', async (req, res) => {
  const { event_id, slot_index, user_id } = req.body;
  try {
    await pool.query(
      'DELETE FROM bookings WHERE event_id = $1 AND slot_index = $2 AND user_id = $3',
      [event_id, slot_index, user_id]
    );
    res.json({ message: "Запись отменена" });
  } catch (err) {
    res.status(500).json({ error: "Ошибка при отмене" });
  }
});

// Создать новое событие (карточку)
app.post('/api/events', async (req, res) => {
  try {
    const { creator_id, slots_count, start_time } = req.body;

    // Запрос в базу: вставляем данные и просим вернуть созданную строку (RETURNING *)
    const query = `
      INSERT INTO events (creator_id, slots_count, start_time) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `;
    
    const values = [creator_id, slots_count, start_time];
    const result = await pool.query(query, values);

    res.status(201).json(result.rows[0]); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Не удалось создать карточку" });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Сначала удаляем все записи на это событие
    await pool.query('DELETE FROM bookings WHERE event_id = $1', [id]);
    // Затем удаляем само событие
    await pool.query('DELETE FROM events WHERE id = $1', [id]);
    
    res.json({ message: "Событие и записи удалены" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при удалении события" });
  }
});

// Получить список всех событий вместе с участниками
app.get('/api/events', async (req, res) => {
  try {
    const query = `
      SELECT e.*, 
      COALESCE(
        json_agg(b.*) FILTER (WHERE b.id IS NOT NULL), 
        '[]'
      ) as participants
      FROM events e
      LEFT JOIN bookings b ON e.id = b.event_id
      GROUP BY e.id
      ORDER BY e.start_time DESC
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Не удалось получить список событий" });
  }
});

// Записаться на конкретный слот
app.post('/api/bookings', async (req, res) => {
  const { event_id, slot_index, user_id, user_name, user_photo } = req.body;

  try {
    // 1. Проверяем, не занят ли уже этот слот
    const check = await pool.query(
      'SELECT id FROM bookings WHERE event_id = $1 AND slot_index = $2',
      [event_id, slot_index]
    );

    if (check.rows.length > 0) {
      return res.status(400).json({ error: "Этот слот уже занят другим пацаном!" });
    }

    // 2. Если свободен — записываем
    const result = await pool.query(
      `INSERT INTO bookings (event_id, slot_index, user_id, user_name, user_photo) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [event_id, slot_index, user_id, user_name, user_photo]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при записи" });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});