# Solar Expense Tracker - Frontend

A sleek, modern expense management system designed specifically for solar installation teams. Built with React 19, Vite, and Tailwind CSS.

## 🚀 Features

- **Role-Based Access Control**: Separate interfaces for Owners and Workers.
- **Worker Management**: Add workers, manage balances, and track their spending history.
- **Site Tracking**: Manage solar installation sites, track project costs, and calculate profits in real-time.
- **Daily Overhead**: Log general expenses like fuel, food, and maintenance.
- **Audit System**: Detailed monthly and annual financial summaries for owners.
- **Luxury UI**: Dark-themed, high-contrast interface with interactive charts and toast notifications.

## 🛠 Tech Stack

- **React 19**: Modern UI development.
- **Vite**: Ultra-fast build tool and dev server.
- **Tailwind CSS**: Luxury styling with a custom "Night & Gold" theme.
- **Lucide React**: Beautiful, consistent iconography.
- **Zod**: Robust client-side data validation.

## 📦 Setup & Installation

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd expense-tracker-frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

4. **Run in development mode**:
   ```bash
   npm run dev
   ```

5. **Build for production**:
   ```bash
   npm run build
   ```

## 🌐 Deployment (Netlify)

This project is pre-configured for deployment on Netlify.

1. **GitHub Connection**: Push your code to GitHub.
2. **Netlify Setup**:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
3. **Environment Variables**:
   - Add `VITE_API_URL` pointing to your deployed backend (e.g., `https://your-api.com/api`).
4. **Routing**: The `public/_redirects` file is already included to handle SPA routing.

## 🔐 Security Note

- JWT tokens are stored in `localStorage` for session persistence.
- Ensure your backend `CORS_ORIGIN` matches your Netlify domain once live.
- Always use HTTPS in production.

## 📄 License

Private Project. All rights reserved.
