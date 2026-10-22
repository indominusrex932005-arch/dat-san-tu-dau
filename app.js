import facilityRoutes from './routes/facility.routes.js';
import express from 'express';
import homeRoutes from './routes/home.routes.js';


const app = express();

app.set('view engine', 'ejs'); 
app.set('views', './views');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/', homeRoutes);
app.use('/facilities', facilityRoutes);
app.use('/assets', express.static('public'));

export default app;
