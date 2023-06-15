// Copyright © ThroughPuter, Inc. Patents issued and pending.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// const readline = require('readline');
// const estimateExchangeRate = require('./estimator');
// const predictExchangeRate = require('./prediction');

class RPS extends Vue {
  constructor(arg) {
    super(arg);

    let rps = this;

    // The depth of the human play history used to make predictions (# X variables for predictor).
    this.HISTORY_DEPTH = 4;
    // History of plays made by AI, for all of time. (Human history is this.premonition.history.)
    // [0] is the first play, and so on.
    // Note that the next AI play is determined immediately once the human makes a play, so the AI is
    // generally ahead by one play.
    this.ai_history = [];
    this.user_history = []; // Added: History of plays made by the user
    // Running totals.
    this.wins = {
      human: 0,
      ai: 0,
      tie: 0,
    };
    this.winner_message = {
      human: "You WON!!!",
      ai: "AI WON",
      tie: "Tie",
    };

    // ****************************
    // DEBUG
    //
    // Automated human plays for debug.
    this.auto_play = [
      /*
      0,0,0,0,0,0,0,0,0,0,
      1,1,1,1,1,1,1,1,1,1,
      2,2,2,2,2,2,2,2,2,2
      */
    ];

    let onclosefn = function () {
      alert("WebSocket connection closed. Please refresh the page.");
    };
    let onerrorfn = function () {
      alert("Error occured");
    };

    let wsReady = function () {
      // Websocket is ready. Start doing stuff.

      rps.makePrediction();

      // JQuery bindings.

      $("#reveal").change(function () {
        if (this.checked) {
          $("#AI-player").addClass("reveal");
        } else {
          $("#AI-player").removeClass("reveal");
        }
      });

      $("#human-player .hand-container").click(function (evt) {
        if (rps.ready) {
          $("#human-player .hand-container").removeClass("selected");
          $(".hand-selected-img", this).parent().addClass("selected");

          rps.determineWinner(parseInt(this.getAttribute("data-hand-index")));
          rps.makePrediction();
        }
      });
    };

    let predictionCB = (preds, info) => {
      rps.predictionCB(preds, info);
    };

    // To utilize your access to a ThroughPuter Estimator microservice, provide your secret key here, HOWEVER...
    // IMPORTANT!!! It is your responsibility to keep your secret key secret. This code is visible in a user's web browser,
    //              and this demo is not intended to be hosted publicly with your private key.
    this.prediction = new Prediction(
      4,
      true,      // TODO: This looks suspect. Probablistic objects are not supported yet.
      `<wss://bypass.passgraf.com:8117/ws/00ud0z3x17KKw0Ot94x7>`,   // Copy-paste from estimatorlab.com/estimator >> Estimator API Key >> Show API Key >> Copy.
      predictionCB,
      { onopen: wsReady, onclose: onclosefn, onerror: onerrorfn }
    );

    //wsReady();
  }

  // Return a random hand index.
  randomHandIndex() {
    return Math.floor(Math.random() * 3);
  }

  // The human has played. Conduct the contest.
  determineWinner(human_index) {
    // Update state
    this.prediction.pushValue(human_index);
    let ai_index = this.ai_history[this.ai_history.length - 1];
    let winner = this.winner(human_index, ai_index);
    this.wins[winner]++;
    
    // Reflect AI play in DOM
    $(`#${winner}-score`).text(this.wins[winner].toString());
    $("#AI-player .hand-container").removeClass("selected");
    $(`#AI-player .hand-container[data-hand-index=${ai_index}]`).addClass("selected");
    $("#winner-message").text(this.winner_message[winner]);
    
    console.log(`Contest: Human: ${human_index}; AI: ${ai_index}. ${this.winner_message[winner]}`);
    
    // Added: Update user play history
    this.user_history.push(human_index);
    if (this.user_history.length > this.HISTORY_DEPTH) {
      this.user_history.shift();
    }

    // Update exchange rate prediction based on the first 4 selections
    if (this.ai_history.length === this.HISTORY_DEPTH) {
      let predictionInputs = this.ai_history.slice(0, this.HISTORY_DEPTH);
      // Make a request to your exchange rate prediction model/API with predictionInputs
      // Update the AI's play based on the predicted exchange rate
      let predictedAIPlay = '<wss://bypass.passgraf.com:8117/ws/00ud0z3x17KKw0Ot94x7>';
      this.ai_history.push(predictedAIPlay);
    } else {
      // Continue with random AI play until the user has made 4 selections
      let randomAIPlay = this.randomHandIndex();
      this.ai_history.push(randomAIPlay);
    }
    
    this.makePrediction();
  }

  predictionCB(preds, info) {
    let pred_index = preds[0].est;
    // Determine AI play to win against the prediction.
    var ai_play_index = this.winningIndex(pred_index);
    this.ai_history.push(ai_play_index);
    // Ready to play, but introduce a minimum delay while the DOM conveys the result of the previous battle.
    $(".probabilities").text(""); // Clear old predictions in DOM.
    window.setTimeout(() => {
      // Reflect selection in DOM.
      $(
        `#AI-player .hand-container[data-hand-index=${ai_play_index}]`
      ).addClass("chosen");
      preds.forEach((pred, index) => {
        $(`.probability[index=${this.winningIndex(pred.est)}]`).text(
          `${(pred.num / pred.denom).toFixed(2)}`
        );
      });
      console.log(`Prediction: ${JSON.stringify(preds)}`);
      if (this.auto_play.length > 0) {
        // Make a "human" play automatically (without enabling GUI play).
        this.determineWinner(this.auto_play.shift());
        this.makePrediction();
      } else {
        // Ready for the next interactive prediction.
        this.ready = true;
      }
    }, 300);
  }

  // Make the given prediction.
  _manufacturedPrediction(index) {
    return [
      { est: index, num: 1, denom: 3 },
      { est: (index + 1) % 3, num: 1, denom: 3 },
      { est: (index + 2) % 3, num: 1, denom: 3 },
    ];
  }

  // Predict the human's next play, and, based on that, the AI's next play.
  // Also reflect this in the state and in the DOM.
  makePrediction() {
    // Reflect no-prediction
    this.ready = false;
    $("#AI-player .hand-container").removeClass("chosen");
    
    // Predict human play
    if (this.ai_history.length === this.HISTORY_DEPTH) {
      let predictionInputs = this.ai_history.slice(0, this.HISTORY_DEPTH);
      // Make a request to your exchange rate prediction model/API with predictionInputs
      // Update the AI's play based on the predicted exchange rate
      let predictedAIPlay = '<wss://bypass.passgraf.com:8117/ws/00ud0z3x17KKw0Ot94x7>';
      this.ai_history.push(predictedAIPlay);
    } else {
      // Continue with random AI play until the user has made 4 selections
      let randomAIPlay = this.randomHandIndex();
      this.ai_history.push(randomAIPlay);
    }
    
    // Reflect selection in DOM
    $(`#AI-player .hand-container[data-hand-index=${this.ai_history[this.ai_history.length - 1]}]`).addClass("chosen");
    
    if (this.auto_play.length > 0) {
      // Make a "human" play automatically (without enabling GUI play)
      this.determineWinner(this.auto_play.shift());
      this.makePrediction();
    } else {
      // Ready for the next interactive prediction
      this.ready = true;
    }
  }
  convert() {
    // Conversion logic goes here...
    // Update this.convertedAmount with the calculated result.

    // Add the user's selection to the history after 4 trials.
    if (this.user_history.length < 4) {
      this.user_history.push(this.currencies.indexOf(this.fromCurrency));
    }

    // AI's prediction based on user's previous selections.
    if (this.user_history.length >= 4) {
      this.ai_prediction = this.user_history.slice(-4);
    }
  }
}

// $(document).ready(function () {
//   var rps_app = new RPS();
//   // Call the _manufacturedPrediction method
//   var predictions = rps_app._manufacturedPrediction(0);
//   console.log(predictions);
// });

// $(document).ready(function () {
//   var rps_app = new RPS({
//     el: "#body",
//     data: {
//       players: [{ name: "human" }, { name: "AI" }],
//       hands: [
//         { index: 0, name: "USD" },
//         { index: 1, name: "EUR" },
//         { index: 2, name: "CAD" },
//       ],
//       ready: false,
//     },
//   });
// });



