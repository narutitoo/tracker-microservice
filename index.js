const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/public', express.static(`${__dirname}/public`));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Conexión a MongoDB usando variable de entorno
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Error conectando a MongoDB:', err));

// MODELOS

const userSchema = new mongoose.Schema({
  username: { type: String, required: true }
});

const exerciseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, required: true }
});

const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);

// RUTAS

// 1. Crear usuario - POST /api/users
app.post('/api/users', async (req, res) => {
  try {
    const username = req.body.username;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const user = new User({ username });
    await user.save();

    res.json({ username: user.username, _id: user._id });
  } catch (err) {
    res.status(500).json({ error: 'Error creando usuario' });
  }
});

// 2. Obtener todos los usuarios - GET /api/users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username _id').exec();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo usuarios' });
  }
});

// 3. Añadir ejercicio - POST /api/users/:_id/exercises
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const userId = req.params._id;
    const { description, duration, date } = req.body;

    if (!description || !duration) {
      return res.status(400).json({ error: 'Description and duration required' });
    }

    // Validar usuario existe
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Fecha por defecto: hoy si no envían
    const exerciseDate = date ? new Date(date) : new Date();
    // Formatear fecha para que sea válida
    if (isNaN(exerciseDate)) return res.status(400).json({ error: 'Invalid date format' });

    const exercise = new Exercise({
      userId,
      description,
      duration: Number(duration),
      date: exerciseDate
    });

    await exercise.save();

    res.json({
      _id: user._id,
      username: user.username,
      date: exercise.date.toDateString(),
      duration: exercise.duration,
      description: exercise.description
    });
  } catch (err) {
    res.status(500).json({ error: 'Error creando ejercicio' });
  }
});

// 4. Obtener logs - GET /api/users/:_id/logs
// Soporta query params: from, to, limit
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const userId = req.params._id;
    const { from, to, limit } = req.query;

    // Buscar usuario
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Construir filtro de fechas
    let dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);

    const filter = {
      userId,
      ...(from || to ? { date: dateFilter } : {})
    };

    // Consulta con límite si existe
    let query = Exercise.find(filter).select('description duration date -_id');
    if (limit) query = query.limit(Number(limit));

    const exercises = await query.exec();

    const log = exercises.map(e => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString()
    }));

    res.json({
      _id: user._id,
      username: user.username,
      count: log.length,
      log
    });

  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo logs' });
  }
});

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor funcionando en http://localhost:${PORT}`);
});
