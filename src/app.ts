import express from 'express';
import cors from 'cors';
import { askRoutes } from './routes/ask.routes';
import { slackRoutes } from './routes/slack.routes';
import { teamsRoutes } from './routes/teams.routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(express.json());
app.use(cors());

// Routes
app.use('/api', askRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/teams', teamsRoutes);

// Global Error Handler
app.use(errorHandler);

export { app };
