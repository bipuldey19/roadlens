// server.js
const express = require("express");
const axios = require("axios");
const path = require("path");
const Papa = require("papaparse");
const { fileURLToPath } = require("url");
const session = require('express-session');
const auth = require('./middleware/auth');
const userAuth = require('./middleware/userAuth');
const generateAvatarUrl = require('./config/avatar');

const app = express();
const PORT = process.env.PORT || 4000;

// Set EJS as templating engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({ extended: true }));

// Add session middleware
app.use(session({
    secret: 'FuckTheFuckingFuckersBeforeTheyFuckYou!',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Make avatar generator available to all views
app.locals.generateAvatarUrl = generateAvatarUrl;

const uploadRouter = require('./routes/upload');
app.use('/', uploadRouter);

// Add auth routes before protected routes
const authRouter = require('./routes/auth');
app.use('/', authRouter);

// Split evaluation routes into public and admin routes
const evaluationRouter = require('./routes/evaluation');
app.use('/', evaluationRouter.publicRoutes); // Public routes
app.use('/admin', auth, evaluationRouter.adminRoutes); // Protected admin routes

// Add survey routes
const surveyRouter = require('./routes/survey');
app.use('/', surveyRouter.publicRoutes);
app.use('/admin', auth, surveyRouter.adminRoutes);

// Add AI overview routes
const aiOverviewRouter = require('./routes/aiOverview');
app.use('/', aiOverviewRouter);

// Survey page route (requires user auth)
app.get("/survey", async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    try {
        res.render("survey", {
            userEmail: req.session.userEmail
        });
    } catch (error) {
        console.error("Survey page error:", error);
        res.status(500).render("error", {
            message: "Failed to load survey page"
        });
    }
});

// Cache mechanism
let cachedData = null;
let lastFetched = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchData() {
  if (cachedData && lastFetched && Date.now() - lastFetched < CACHE_DURATION) {
    return cachedData;
  }

  const csv_url =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYSUOh5kElFlNoJb7j8f1gNMBs6m76JSj0nAknc6vomY5JkCBsVVLPr4kBu6J03__pH0rJsuVkoYOO/pub?output=csv";

  try {
    const response = await axios.get(csv_url);
    const csvData = response.data;

    // Parse CSV data using PapaParse
    const parsedData = Papa.parse(csvData, {
      header: true, // Automatically uses the first row as column headers
      skipEmptyLines: true, // Skip empty lines
    });

    // Map and clean up the data
    const rows = parsedData.data.map((row) => ({
      DateTime_1: row.DateTime_1
        ? new Date(row.DateTime_1.replace(" ", "T").replace(".", ":"))
        : null,
      Distress_Type: row.Distress_Type?.trim(),
      Distress_Level: row.Distress_Level?.trim(),
      Severity: row.Severity?.trim(),
      File_URL: row.File_URL?.trim(),
      latitude_y: parseFloat(row.latitude_y),
      longitude_x: parseFloat(row.longitude_x),
    }));

    cachedData = rows;
    lastFetched = Date.now();
    return rows;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
}

async function fetchSurveyQuestions() {
  const ques_csv_url =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8fFNkG24M2faL6mRCd2jptGwzxzL71hdxr2B19bFewrXQJ8PDoHRC99bNX9mCSKoXiXcI29DH0_Ne/pub?gid=0&single=true&output=csv";

  try {
    const quesResponse = await axios.get(ques_csv_url);
    const quesCsvData = quesResponse.data;

    // Parse CSV data
    const quesParsedData = Papa.parse(quesCsvData, {
      header: true,
      skipEmptyLines: true,
    });

    // console.log("Total rows:", quesParsedData.data.length);

    // Separate processing for multiple choice and image questions
    const multiQuestions = quesParsedData.data
      .filter(row => row.QuesId && row.MultiQues?.trim())
      .map(row => ({
        quesId: row.QuesId,
        multiQues: row.MultiQues?.trim() || null,
        options: {
          A: row.A?.trim() || null,
          B: row.B?.trim() || null,
          C: row.C?.trim() || null,
          D: row.D?.trim() || null,
        },
        multiAns: row.MultiAns?.trim() || null
      }))
      .filter(row => Object.values(row.options).some(opt => opt !== null));

    const imgQuestions = quesParsedData.data
      .filter(row => row.ImgId && row.ImgQues?.trim())
      .map(row => ({
        imgId: row.ImgId || null,
        imgQues: row.ImgQues?.trim() || null,
        distressType: row.DistressType?.trim() || null,
        distressLevel: row.DistressLevel?.trim() || null
      }));

    const availableMulti = multiQuestions.length;
    const availableImg = imgQuestions.length;

    // console.log("Multiple choice questions found:", availableMulti);
    // console.log("Image questions found:", availableImg);

    const requestedMulti = Math.min(5, availableMulti);
    const requestedImg = Math.min(4, availableImg);

    // console.log(`Requesting - Multi: ${requestedMulti}, Image: ${requestedImg}`);

    // if (imgQuestions.length > 0) {
    //   console.log("Sample image question:", imgQuestions[0]);
    // }
    // if (multiQuestions.length > 0) {
    //   console.log("Sample multiple choice question:", multiQuestions[0]);
    // }

    const randomMulti = getRandomQuestions(multiQuestions, requestedMulti);
    const randomImg = getRandomQuestions(imgQuestions, requestedImg);

    return {
      multipleChoice: randomMulti,
      imageQuestions: randomImg,
      counts: {
        availableMulti,
        availableImg,
        selectedMulti: randomMulti.length,
        selectedImg: randomImg.length,
      },
    };
  } catch (error) {
    console.error("Error fetching survey questions:", error);
    throw error;
  }
}

// Helper function to get random questions
function getRandomQuestions(questions, count) {
  if (!questions.length) return [];
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Routes
app.get("/", async (req, res) => {
  try {
    const data = await fetchData();
    const uniqueDistressTypes = [
      ...new Set(data.map((point) => point.Distress_Type)),
    ];

    res.render("index", {
      data,
      uniqueDistressTypes,
      selectedLayer: req.query.layer || "All Distresses",
      selectedType: req.query.type || "",
      selectedSeverity: req.query.severity || "",
      userEmail: req.session.userEmail,
      adminEmail: req.session.adminEmail
    });
  } catch (error) {
    res.status(500).render("error", { error: "Failed to fetch data" });
  }
});

app.get("/evaluation", async (req, res) => {
  try {
    const questions = await fetchSurveyQuestions();

    // Check if we have enough questions
    if (
      questions.multipleChoice.length === 0 &&
      questions.imageQuestions.length === 0
    ) {
      throw new Error("No questions available in the dataset");
    }

    // console.log("Question counts:", questions.counts);

    res.render("evaluation", {
      multiQuestions: questions.multipleChoice,
      imgQuestions: questions.imageQuestions,
      questionCounts: questions.counts,
    });
  } catch (error) {
    console.error("Survey error:", error);
    res.status(500).render("error", {
      message: "Failed to fetch survey questions"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
