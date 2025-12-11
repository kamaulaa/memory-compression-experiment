// ================================
// INIT jsPsych + SERVER UPLOAD
// ================================

// Warn user before leaving page
let experimentFinished = false;
window.addEventListener('beforeunload', function (e) {
  if (!experimentFinished) {
    e.preventDefault();
    e.returnValue = 'Your data has not been saved! Are you sure you want to leave?';
    return e.returnValue;
  }
});

const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: false,

  on_finish: function () {
    const data = jsPsych.data.get().values();

    fetch("/save-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
      experimentFinished = true;
      if (result.github_saved) {
        console.log("✅ Data saved to GitHub successfully.");
      } else {
        console.error("⚠️ Data saved locally only - GitHub save failed!");
        alert("⚠️ Warning: Data may not have been saved to GitHub. Please notify the experimenter.");
      }
    })
    .catch(err => {
      console.error("❌ Failed to save data:", err);
      alert("❌ Error: Data may not have been saved. Please notify the experimenter.");
    });
  }
});

// ================================
// AUTO PARTICIPANT NUMBER
// ================================

let participant_number = localStorage.getItem("participant_number");

if (participant_number === null) {
  participant_number = 1;
} else {
  participant_number = parseInt(participant_number) + 1;
}

localStorage.setItem("participant_number", participant_number);

jsPsych.data.addProperties({
  participant_number: participant_number
});

// ================================
// NETID ENTRY
// ================================

const netid_trial = {
  type: jsPsychSurvey,
  survey_json: {
    title: "Participant Information",
    description: "Please turn ON Caps Lock before continuing.",
    pages: [
      {
        elements: [
          { type: "text", name: "netid", title: "Enter your Princeton NetID:", isRequired: true }
        ]
      }
    ]
  },
  on_finish: function (data) {
    jsPsych.data.addProperties({
      netid: data.response.netid.trim().toLowerCase()
    });
  }
};

// ================================
// TASK OVERVIEW
// ================================

const task_overview = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <h2>What You Will Be Doing</h2>
    <p>You will see a short sequence of <b>7 letters</b>.</p>
    <p>You will then have <b>10 seconds</b> to type what you remember.</p>
    <p>You may press <b>Enter</b> to submit early.</p>
    <p>First, you will complete one practice trial.</p>
  `,
  choices: ["Continue"],
  on_load: function() {
    document.addEventListener("keydown", function handler(e) {
      if (e.key === "Enter") {
        document.removeEventListener("keydown", handler);
        document.querySelector("button").click();
      }
    });
  }
};

// ================================
// STIMULI (32 total: 16 patterned + 16 random)
// ================================

const patterned_sequences = [
  "ABABABA","CDCDCDC","EFEFEFE","GHGHGHG",
  "AABBCCD","MMNNOOP","EEFFGGH","QQRRSSA",
  "ABCDEFG","KLMNOPQ","RSTUVWX","HIJKLMN",
  "ABCDCBA","CDEFGED","MNOPNM","XYZYZYX"
];

const random_sequences = [
  "QZTRPNL","BDFHJLK","CMFGLQT","HXJKQTV",
  "RLVTXPW","NJQHZBM","SPKFDLR","MWRQZTA",
  "XBFNQJT","KVMPZRC","DLHGWXS","YTQBFNJ",
  "ZPCMKHR","WGLDTXV","FNBJQSK","HRCMPZL"
];

let all_sequences = jsPsych.randomization.shuffle(
  patterned_sequences.concat(random_sequences)
);

// ================================
// COMPRESSIBILITY DETECTOR
// ================================

function detect_compressibility(seq) {
  if (seq.slice(0,2) === seq.slice(2,4) && seq.slice(2,4) === seq.slice(4,6))
    return { type: "REPEAT", score: 3 };

  if (seq[0] === seq[1] && seq[2] === seq[3] && seq[4] === seq[5])
    return { type: "GROUP", score: 2 };

  let is_run = true;
  for (let i = 0; i < seq.length - 1; i++) {
    if (seq.charCodeAt(i+1) !== seq.charCodeAt(i) + 1) is_run = false;
  }
  if (is_run) return { type: "RUN", score: 3 };

  if (seq === seq.split("").reverse().join("")) return { type: "MIRROR", score: 3 };

  return { type: "RANDOM", score: 0 };
}

// ================================
// INSTRUCTIONS
// ================================

const instructions = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <h2>Memory Task Instructions</h2>
    <p>You will have <b>10 seconds</b> for each recall.</p>
    <p>You may press <b>Enter</b> to submit early.</p>
    <p>Please keep <b>Caps Lock ON</b>.</p>
  `,
  choices: ["Begin Practice"],
  on_load: function() {
    document.addEventListener("keydown", function handler(e) {
      if (e.key === "Enter") {
        document.removeEventListener("keydown", handler);
        document.querySelector("button").click();
      }
    });
  }
};

// ================================
// PRACTICE TRIAL
// ================================

const practice_display = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: "<h1>ABCABCA</h1>",
  choices: "NO_KEYS",
  trial_duration: 2500
};

const practice_recall = {
  type: jsPsychSurveyHtmlForm,
  preamble: '<p>Type what you remember. Press Enter to submit:</p><p id="timer" style="font-size: 24px; font-weight: bold;">10</p>',
  html: '<input type="text" id="practice_recall" name="practice_recall" autocomplete="off" autofocus style="font-size: 24px; padding: 10px; width: 300px; text-transform: uppercase;">',
  button_label: "Submit",
  autofocus: "practice_recall",
  on_load: function() {
    let timeLeft = 10;
    const timerEl = document.getElementById("timer");
    
    // Clear any existing timer
    if (window.recallTimer) clearInterval(window.recallTimer);
    
    window.recallTimer = setInterval(() => {
      timeLeft--;
      if (timerEl) timerEl.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(window.recallTimer);
        const btn = document.querySelector("#jspsych-survey-html-form-next");
        if (btn) btn.click();
      }
    }, 1000);
    
    // Clear timer when form is submitted
    const form = document.querySelector("#jspsych-survey-html-form");
    if (form) {
      form.addEventListener("submit", () => clearInterval(window.recallTimer));
    }
  }
};

// ================================
// PRACTICE COMPLETE
// ================================

const practice_complete = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <h2>Practice Complete</h2>
    <p>You will now complete <b>32 real trials</b>.</p>
    <p>Press Continue when you are ready.</p>
  `,
  choices: ["Start"],
  on_load: function() {
    document.addEventListener("keydown", function handler(e) {
      if (e.key === "Enter") {
        document.removeEventListener("keydown", handler);
        document.querySelector("button").click();
      }
    });
  }
};

// ================================
// BUILD REAL TRIAL TIMELINE (FLAT)
// ================================

let trial_count = 0;
const total_trials = 32;
let real_trials = [];

all_sequences.forEach(sequence => {
  const comp = detect_compressibility(sequence);

  // ---- DISPLAY ----
  real_trials.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<h1>${sequence}</h1>`,
    choices: "NO_KEYS",
    trial_duration: 2500
  });

  // ---- RECALL ----
  real_trials.push({
    type: jsPsychSurveyHtmlForm,
    preamble: '<p>Type what you remember. Press Enter to submit:</p><p id="timer" style="font-size: 24px; font-weight: bold;">10</p>',
    html: '<input type="text" id="recall" name="recall" autocomplete="off" autofocus style="font-size: 24px; padding: 10px; width: 300px; text-transform: uppercase;">',
    button_label: "Submit",
    autofocus: "recall",
    on_load: function() {
      let timeLeft = 10;
      const timerEl = document.getElementById("timer");
      
      // Clear any existing timer
      if (window.recallTimer) clearInterval(window.recallTimer);
      
      window.recallTimer = setInterval(() => {
        timeLeft--;
        if (timerEl) timerEl.textContent = timeLeft;
        if (timeLeft <= 0) {
          clearInterval(window.recallTimer);
          const btn = document.querySelector("#jspsych-survey-html-form-next");
          if (btn) btn.click();
        }
      }, 1000);
      
      // Clear timer when form is submitted
      const form = document.querySelector("#jspsych-survey-html-form");
      if (form) {
        form.addEventListener("submit", () => clearInterval(window.recallTimer));
      }
    },

    on_finish: function (data) {
      // Handle case where response might be null/undefined (timeout with no input)
      let response = "";
      if (data.response && data.response.recall) {
        response = data.response.recall.toUpperCase().replace(/\s/g, "");
      }

      let correct = 0;
      for (let i = 0; i < sequence.length; i++) {
        if (response[i] === sequence[i]) correct++;
      }

      // Save all relevant data for analysis
      data.sequence = sequence;           // Expected (what was shown)
      data.recall = response;             // Input (what they typed)
      data.correct_count = correct;       // Number of letters correct
      data.total_letters = sequence.length; // Total letters (7)
      data.accuracy = correct / sequence.length; // Proportion correct (0-1)
      data.compressibility = comp.score;  // Compressibility score (0-3)
      data.pattern_type = comp.type;      // Pattern type (REPEAT, GROUP, RUN, MIRROR, RANDOM)
      data.rt_seconds = data.rt / 1000;   // Response time in seconds

      trial_count++;
      jsPsych.progressBar.progress = trial_count / total_trials;
    }
  });
});

// ================================
// FINAL STRATEGY QUESTION
// ================================

const strategy_question = {
  type: jsPsychSurvey,
  survey_json: {
    title: "Final Question",
    pages: [
      {
        elements: [
          { type: "comment", name: "strategy", title: "Briefly describe how you tried to remember the sequences:" }
        ]
      }
    ]
  },
  on_finish: function(data) {
    // Save strategy to all data rows
    const strategy = data.response && data.response.strategy ? data.response.strategy : "";
    jsPsych.data.addProperties({ strategy: strategy });
  }
};

// ================================
// END SCREEN
// ================================

const end_screen = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <h2>Task Complete</h2>
    <p>Thank you for participating.</p>
    <p><b>⚠️ You MUST click "Finish" below to submit your data!</b></p>
    <p>Questions: <b>kr6550@princeton.edu</b></p>
  `,
  choices: ["Finish"]
};

const close_screen = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: `
    <h2>Data Submitted Successfully</h2>
    <p>Your responses have been recorded.</p>
    <p>You may now close this window.</p>
  `,
  choices: "NO_KEYS"
};

// ================================
// RUN EXPERIMENT
// ================================

jsPsych.run([
  netid_trial,
  task_overview,
  instructions,
  practice_display,
  practice_recall,
  practice_complete,
  ...real_trials,
  strategy_question,
  end_screen,
  close_screen
]);
