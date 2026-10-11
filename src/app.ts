import express from 'express';
import cors from 'cors';
import { askRoutes } from './routes/ask.routes';
import { slackRoutes } from './routes/slack.routes';
import { teamsRoutes } from './routes/teams.routes';
import { stripeRoutes } from './routes/stripe.routes';
import { workspaceRoutes } from './routes/workspace.routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(cors());

// Stripe Webhook route mounted before standard json parser to preserve raw payload
app.use('/api/stripe', stripeRoutes);

// Global JSON parser with raw body buffer attachment
app.use(express.json({
    verify: (req: any, _res, buf) => {
        req.rawBody = buf;
    }
}));

// Application Routes
app.use('/api', askRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/workspaces', workspaceRoutes);

// Global Error Handler
app.use(errorHandler);

export { app };
