# 🚀 Telegram Mini-App Deployment Guide

## Prerequisites
- A Telegram bot (create with [@BotFather](https://t.me/botfather))
- Your backend deployed and accessible via HTTPS
- Node.js and npm installed

## 📋 Step-by-Step Deployment

### 1. Deploy Your Backend
Deploy your backend to a service like:
- **Railway**: Easy PostgreSQL + Node.js deployment
- **Heroku**: Classic option with PostgreSQL addon
- **DigitalOcean App Platform**: Good performance
- **AWS/GCP/Azure**: For enterprise

Make sure your backend URL is HTTPS (e.g., `https://your-backend.railway.app`)

### 2. Deploy Your Mini-App

#### Option A: Netlify (Recommended)
1. Push your code to GitHub
2. Connect your GitHub repo to Netlify
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Add environment variable: `VITE_API_BASE_URL=https://your-backend-url.com`

#### Option B: Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts
4. Set environment variable: `VITE_API_BASE_URL=https://your-backend-url.com`

### 3. Configure Your Telegram Bot

#### Set Menu Button (Persistent Access)
```
/setmenubutton
@your_bot_name
🏐 Volleyball Games
https://your-mini-app-url.com
```

#### Set Bot Commands
```
/setcommands
@your_bot_name
start - Welcome message and open app
games - Open volleyball games app
```

### 4. Update Your Environment Variables

#### Backend (.env)
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
MINI_APP_URL=https://your-mini-app-url.com
DATABASE_URL=postgresql://username:password@host:port/database
```

#### Mini-App (.env)
```
VITE_API_BASE_URL=https://your-backend-url.com
VITE_TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### 5. Update CORS Configuration

Make sure your backend's CORS allows your mini-app domain:

```typescript
const corsOrigins = [
  'http://localhost:3001', // Development
  'https://your-mini-app.netlify.app', // Production
  // Add your actual deployed URL here
];
```

## 🧪 Testing Your Deployment

1. **Test the backend API** directly:
   ```bash
   curl https://your-backend-url.com/games
   ```

2. **Test the mini-app** in a browser:
   - Visit your deployed mini-app URL
   - Check browser console for errors

3. **Test in Telegram**:
   - Send `/start` to your bot
   - Click the mini-app button
   - Test all functionality

## 🔍 Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure your backend allows your mini-app domain
2. **Authentication Issues**: Check that Telegram WebApp data is being sent correctly
3. **API Connection**: Verify your backend URL is correct and accessible
4. **Database Connection**: Ensure your database is running and accessible

### Debug Steps:
1. Check browser console for JavaScript errors
2. Check network tab for failed API requests
3. Check backend logs for errors
4. Test API endpoints directly with curl/Postman

## 📱 Mini-App Features Checklist

- ✅ Games list with player counts
- ✅ Game details with registered players
- ✅ Join/Unregister functionality
- ✅ Telegram theme integration
- ✅ Back button navigation
- ✅ Loading states and error handling
- ✅ Responsive mobile design

## 🎯 Next Steps

After successful deployment:
1. Test all functionality thoroughly
2. Consider adding push notifications
3. Add real-time updates with WebSockets
4. Implement admin features if needed
5. Monitor usage and performance

## 🆘 Need Help?

If you encounter issues:
1. Check the browser console and network tab
2. Review backend logs
3. Verify all environment variables are set correctly
4. Test API endpoints independently
