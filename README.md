# 🚀 Blue Angel API

A RESTful API server built with **Node.js**, **Express.js**, and **MongoDB**, with support for authentication, external API integrations (OpenAI, Google Gemini, OpenWeather), and email services.

---

## 📦 Features

- **JWT-based Authentication** - Secure user authentication and authorization
- **MongoDB Database** - Data persistence with Mongoose ODM
- **Email Services** - Email sending via Nodemailer with OTP support
- **External API Integrations**:
  - OpenAI GPT for AI-powered features
  - Google Gemini AI integration
  - OpenWeather API for weather data
- **Comprehensive API Documentation** - Swagger/OpenAPI documentation
- **Modular Architecture** - Organized controllers, routes, and middleware
- **Environment Configuration** - Secure environment variable management
- **Easy Deployment** - Ready for Vercel serverless deployment

---

## 🛠️ Getting Started

### 1. Clone the Repo

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file and update the values:

```bash
cp .env.sample .env
```

Update `.env` with your secrets:

```env
PORT=3000
MONGO_URI=your-mongo-uri
EMAIL=your-email@example.com
EMAIL_PASS=your-email-password
BASE_URL=http://localhost:3000
ACCESS_TOKEN_SECRET=your-access-token-secret
REFRESH_TOKEN_SECRET=your-refresh-token-secret
EMAIL_TOKEN_SECRET=your-email-token-secret
GPT_API_KEY=your-openai-api-key
GEMINI_API_KEY=your-gemini-api-key
OPEN_WEATHER_API_KEY=your-open-weather-api-key
```

### ▶️ Run the Server Locally

```bash
npm run dev
```

The server runs at http://localhost:3000.

### 📚 API Documentation

The API documentation is available via Swagger UI. Individual endpoint documentation can be found in the `documentation/` folder with separate YAML files for each module:

- Authentication: `auth.swagger.yaml`
- Events & Sliders: `eventSliderRegistration.swagger.yaml`
- Home: `home.swagger.yaml`
- Itinerary: `itinerary.swagger.yaml`
- Profile: `profile.swagger.yaml`
- Webhooks: `webhook.swagger.yaml`

---

## 🚀 Deploying to Vercel

### Step 1: Prepare Your Project for Vercel

#### 1.1 Install Serverless HTTP Package

```bash
npm install serverless-http
```

#### 1.2 Create Vercel Configuration

Create a `vercel.json` file in your project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api/index.js"
    }
  ]
}
```

#### 1.3 Create Serverless Entry Point

Create an `api/` directory and add `index.js`:

```bash
mkdir api
```

Create `api/index.js`:

```js
const serverless = require('serverless-http');
const app = require('../server'); // Import your main Express app

module.exports = serverless(app);
```

#### 1.4 Modify Your Main Server File

Update your `server.js` to export the Express app instead of starting the server:

```js
// At the end of server.js, replace:
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// With:
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
```

### Step 2: Deploy to Vercel

#### Option 1: Deploy via Vercel CLI

1. **Install Vercel CLI globally:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy your project:**
   ```bash
   vercel
   ```

4. **Follow the prompts:**
   - Set up and deploy? `Y`
   - Which scope? Select your account
   - Link to existing project? `N` (for new project)
   - Project name? Enter your project name
   - Directory? `./` (current directory)
   - Override settings? `N`

5. **Your project will be deployed and you'll get a URL!**

#### Option 2: Deploy via GitHub Integration

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Go to Vercel Dashboard:**
   - Visit https://vercel.com/dashboard
   - Click "Add New Project"

3. **Import your GitHub repository:**
   - Connect your GitHub account if not already connected
   - Select your repository
   - Click "Import"

4. **Configure project settings:**
   - Project Name: Enter your desired project name
   - Framework Preset: Select "Other"
   - Root Directory: `./` (leave as default)
   - Build Command: `npm run build` (or leave empty)
   - Output Directory: Leave empty
   - Install Command: `npm install`

5. **Click "Deploy"**

### Step 3: Configure Environment Variables

After deployment, you need to add your environment variables:

1. **Go to your project dashboard on Vercel**
2. **Click on "Settings" tab**
3. **Navigate to "Environment Variables"**
4. **Add all your environment variables one by one:**

   ```
   MONGO_URI=your-mongodb-connection-string
   EMAIL=your-email@example.com
   EMAIL_PASS=your-email-app-password
   BASE_URL=https://your-vercel-app.vercel.app
   ACCESS_TOKEN_SECRET=your-access-token-secret
   REFRESH_TOKEN_SECRET=your-refresh-token-secret
   EMAIL_TOKEN_SECRET=your-email-token-secret
   GPT_API_KEY=your-openai-api-key
   GEMINI_API_KEY=your-gemini-api-key
   OPEN_WEATHER_API_KEY=your-openweather-api-key
   NODE_ENV=production
   ```

5. **Click "Save" for each variable**

### Step 4: Redeploy with Environment Variables

After adding environment variables:

1. **Go to the "Deployments" tab**
2. **Click on the three dots (...) next to your latest deployment**
3. **Select "Redeploy"**
4. **Choose "Use existing Build Cache" and click "Redeploy"**

### Step 5: Test Your Deployment

1. **Visit your Vercel URL** (e.g., `https://your-project-name.vercel.app`)
2. **Test your API endpoints:**
   ```bash
   curl https://your-project-name.vercel.app/api/health
   ```
3. **Check the function logs** in Vercel dashboard under "Functions" tab

### Step 6: Set Up Custom Domain (Optional)

1. **Go to your project settings**
2. **Click on "Domains" tab**
3. **Add your custom domain**
4. **Follow the DNS configuration instructions**

### 🔧 Troubleshooting

#### Common Issues:

1. **MongoDB Connection Issues:**
   - Ensure your MongoDB URI allows connections from all IPs (0.0.0.0/0)
   - Use MongoDB Atlas for cloud hosting

2. **Environment Variables Not Loading:**
   - Double-check variable names match exactly
   - Redeploy after adding variables

3. **Function Timeout:**
   - Vercel has a 10-second timeout for Hobby plan
   - Optimize your database queries

4. **Static Files Not Serving:**
   - Use Vercel's static file serving for assets
   - Consider using a CDN for large files

#### Checking Logs:

```bash
vercel logs your-project-name
```

### 📊 Monitoring Your Deployment

1. **View Analytics:** Check your Vercel dashboard for traffic analytics
2. **Monitor Performance:** Use Vercel's built-in performance monitoring
3. **Set up Alerts:** Configure notifications for deployment failures

---

## 🌐 Environment Variables on Vercel

After deployment, add environment variables in your Vercel dashboard:

1. Go to your project.
2. Click Settings → Environment Variables.
3. Add the same variables from your `.env` file.

---

## 📁 File Structure

```
.
├── config/
│   └── db.js                    # Database configuration
├── controllers/
│   ├── authController.js        # Authentication logic
│   ├── eventSliderRegistrationController.js
│   ├── homeController.js        # Home page controller
│   ├── itineraryController.js   # Itinerary management
│   ├── profileController.js     # User profile management
│   └── webhookController.js     # Webhook handlers
├── documentation/
│   ├── auth.swagger.yaml
│   ├── eventSliderRegistration.swagger.yaml
│   ├── home.swagger.yaml
│   ├── itinerary.swagger.yaml
│   ├── profile.swagger.yaml
│   └── webhook.swagger.yaml
├── middleware/
│   └── authMiddleware.js        # JWT authentication middleware
├── models/
│   ├── EventAndSlidersRegistration.js
│   ├── Events.js
│   ├── Itinerary.js
│   ├── Sliders.js
│   └── User.js
├── routes/
│   ├── authRoutes.js            # Authentication routes
│   ├── eventsSliderRegistrationRoutes.js
│   ├── homeRoutes.js            # Home page routes
│   ├── itineraryRoutes.js       # Itinerary routes
│   ├── profileRoutes.js         # Profile routes
│   └── webhookRoutes.js         # Webhook routes
├── utils/
│   ├── cleanEventsAndSliders.js # Data cleaning utilities
│   ├── gpthelper-chat.js        # OpenAI GPT integration
│   ├── gpthelper.js             # GPT helper functions
│   ├── hash.js                  # Password hashing utilities
│   ├── otp.js                   # OTP generation
│   ├── sendEmail.js             # Email sending service
│   ├── validateEmail.js         # Email validation
│   └── weatherUpdates.js        # Weather API integration
├── .env                         # Environment variables
├── .env.sample                  # Environment variable template
├── .gitignore                   # Git ignore file
├── LICENSE                      # License file
├── package.json                 # Dependencies and scripts
├── README.md                    # Project documentation
├── server.js                    # Main server file
├── swagger.yaml                 # API documentation
└── yarn.lock                    # Yarn lock file
```

---

## 📫 Contact

- **GitHub**: @Mihir611
- **Email**: mihir17.udupa@gmail.com

---

## 📄 License

This project is licensed under the MIT License.