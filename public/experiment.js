// ================================
// INIT jsPsych + SERVER UPLOAD
// ================================

const jsPsych = initJsPsych({
  show_progress_bar: true,
  auto_update_progress_bar: false,

  on_finish: function () {
    const data = jsPsych.data.get().values();

    fetch("/save-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }).then(() => {
      console.log("✅ Data successfully sent to server.");
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
  preamble: "<p>Type what you remember (10 seconds). Press Enter to submit:</p>",
  html: '<input type="text" id="practice_recall" name="practice_recall" autocomplete="off" autofocus style="font-size: 24px; padding: 10px; width: 300px; text-transform: uppercase;">',
  trial_duration: 10000,
  button_label: "Submit",
  autofocus: "practice_recall"
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
    preamble: "<p>Type what you remember (10 seconds). Press Enter to submit:</p>",
    html: '<input type="text" id="recall" name="recall" autocomplete="off" autofocus style="font-size: 24px; padding: 10px; width: 300px; text-transform: uppercase;">',
    trial_duration: 10000,
    button_label: "Submit",
    autofocus: "recall",

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

      data.sequence = sequence;
      data.recall = response;
      data.accuracy = correct / sequence.length;
      data.compressibility = comp.score;
      data.pattern_type = comp.type;

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
    <p>Questions: <b>kr6550@princeton.edu</b></p>
  `,
  choices: ["Finish"]
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
  end_screen
]);
