import { Dispatch, useEffect, useState, useRef } from 'react'
import './App.css'
import exampleScenarios from './assets/scenarios.json'
import Chart, { ChartConfiguration, ChartConfigurationCustomTypesPerDataset, ChartTypeRegistry } from 'chart.js/auto'
import { FaRegEdit } from "react-icons/fa";
import { BiSolidHide } from "react-icons/bi";
import { FaSave } from "react-icons/fa";
import { FaUpload } from "react-icons/fa";

type Scenario = {
  sources: {[key: string]: any}[];
  [key: string]: any;
  hidden: boolean;
}

function App() {
  var toSimulate = true;
  const graphColors = ['rgb(255,99,132)', 'rgb(99,132,255)', 'rgb(132,255,99)'];
  const [count, setCount] = useState(0)
  const [scenarios, setScenarios] = useState<Scenario[]>(exampleScenarios); //stock portfolio is always index 0... for now...
  const [netWorthsArray, setNetWorthsArray] = useState<[string, string, [string, number][]][]>([]);
  const [scenarioInPopup, setScenarioInPopup] = useState<[number, Scenario]|null>(null);
  const [sourceInPopup, setSourceInPopup] = useState<{[key: string]: any}|null>(null);
  const chart = useRef<Chart | null>(null);
  const simulationYears = 17

  useEffect(() => {
    if (toSimulate) {
      for(let i = 0; i < scenarios.length; i++) simulate(i);
      toSimulate = false;
    }
    graph();
  }, [scenarios])

  const saveFile = async (blob: Blob) => {
    const a = document.createElement('a');
    a.download = Date.now() + '.json';
    a.href = URL.createObjectURL(blob);
    a.addEventListener('click', (e) => {
      setTimeout(() => URL.revokeObjectURL(a.href), 30 * 1000);
    });
    a.click();
  };

  const loadScenarios = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(1)
    // getting a hold of the file reference
    var files = e.target.files; 

    if (files == null) return;

    var file = files[0];

    // setting up the reader
    var reader = new FileReader();
    reader.readAsText(file); // this is reading as data url

    // here we tell the reader what to do when it's done reading...
    reader.onload = readerEvent => {
      var targ = readerEvent.target
      if (targ == null) return;
      var content = targ.result; // this is the content!
      if (content == null) return;
      setScenarios(JSON.parse(content as string) as Scenario[]);
    }
  }

  const config: ChartConfiguration<keyof ChartTypeRegistry, [number, number][], unknown> | ChartConfigurationCustomTypesPerDataset<keyof ChartTypeRegistry, [number, number][], unknown> = {
    type: 'scatter',
    data: {datasets:[]},
    options: {
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          ticks: {
            callback: function(value, index, ticks) {
              let date = new Date(value);
              return date.getMonth()+"/"+date.getDate()+"/"+date.getFullYear()
            }
          }
        },
        y: {
          max: 3000000
        }
      }
    }
  }
  const data: {
    datasets: {
      label: string,
      data: [number, number][],
      backgroundColor: string
    }[]
  } = {
    datasets: []
  }

  function simulate(scenarioIndex: number) {
    var netWorth = 0;
    var netWorths:[string, number][]  = [];
    if (scenarios[scenarioIndex]["type"] == "data") {
      while (netWorthsArray.length <= scenarioIndex) netWorthsArray.push([]);
      console.log(scenarios[scenarioIndex]["data"][0])
      netWorthsArray[scenarioIndex] = [scenarios[scenarioIndex]["name"], scenarios[scenarioIndex]["color"], scenarios[scenarioIndex]["data"]]
      return
    }
    if (scenarios[scenarioIndex]["type"] == "fit") {
      let referenceIndex = scenarios[scenarioIndex]["referenceIndex"]
      var parameters = fitDataContinuousCompoundingWithRegularContributions(scenarios[referenceIndex]["data"])
      console.log(parameters);
      let startDate = new Date(scenarios[referenceIndex]["data"][0][0])

      let days_simulated = 365*simulationYears
      let currentDate = new Date(startDate); // "today" for now
      for(let i = 0; i < days_simulated; i++, currentDate.setDate(currentDate.getDate()+1)) {
        let t = (currentDate.getTime() - startDate.getTime())/(1000*60*60*24*365)
        // console.log(`i: ${i}, currentDate: ${currentDate}, startDate: ${startDate}, t: ${t}, Pert: ${parameters.P * Math.exp(parameters.r * t)}, C/r: ${(parameters.C / parameters.r)}, ert-1: ${Math.exp(parameters.r * t) - 1}`)
        netWorths.push([String(currentDate.toJSON().slice(0,10).replace(/-/g,'/')), parameters.P * Math.exp(parameters.r * t) + (parameters.C / parameters.r) * (Math.exp(parameters.r * t) - 1)])
      }
      while (netWorthsArray.length <= scenarioIndex) netWorthsArray.push(["", "", []]);
      netWorthsArray[scenarioIndex] = [scenarios[scenarioIndex]["name"], scenarios[scenarioIndex]["color"], netWorths];
      return;
    }
    scenarios[scenarioIndex]["sources"].forEach(source => {
      netWorth += (source["type"] == "income" ? 0 : (source["type"] == "asset" ? 1 : -1))*source["value"]
    })

    let days_simulated = 365*simulationYears
    let currentDate = new Date(); // "today" for now

    let sources_copy: {[key: string]: any}[] = JSON.parse(JSON.stringify(scenarios[scenarioIndex]["sources"]))

    for(let i = 0; i < days_simulated; i++, currentDate.setDate(currentDate.getDate()+1)) {
      sources_copy.forEach(source => {
        let sourceType = source["type"];
        // Remove the assets and debts from net worth
        netWorth += (sourceType == "asset" ? -1 : (sourceType == "debt" ? 1 : 0)) * source["value"]
        // Add income to and remove costs from stock portfolio
        sources_copy[0]["value"] += (sourceType == "income" ? 1 : (sourceType == "cost" ? -1 : 0)) * source["value"]/365
        // Increase the value of everything with an interest_rate (everything)
        source["value"] *= Math.E**(source["interest_rate"]/365)
        // Add back in the assets and debts to net worth
        netWorth += (sourceType == "asset" ? 1 : (sourceType == "debt" ? -1 : 0)) * source["value"]
      })
      netWorths.push([String(currentDate.toJSON().slice(0,10).replace(/-/g,'/')), netWorth ])
    }

    while (netWorthsArray.length <= scenarioIndex) netWorthsArray.push(["", "", []]);
    netWorthsArray[scenarioIndex] = [scenarios[scenarioIndex]["name"], scenarios[scenarioIndex]["color"], netWorths];
  }

  function onUpdate(event: any): void {
    if (sourceInPopup == null || scenarioInPopup == null) return;
    const updatedContent = JSON.parse(event.target.innerText);

    console.log("Updating!")

    if (["data", "fit"].includes(scenarioInPopup[1]["type"])) {
      Object.keys(updatedContent).forEach(key => {
        scenarioInPopup[1][key] = updatedContent[key];
      });
    }
    else {
      // Update the properties of the existing object
      Object.keys(updatedContent).forEach(key => {
        sourceInPopup[key] = updatedContent[key];
      });
    }

    // Optionally: Remove properties from thisAsObject that are not in updatedContent
    Object.keys(sourceInPopup).forEach(key => {
      if (!(key in updatedContent)) {
        delete sourceInPopup[key];
      }
    });

    simulate(scenarioInPopup[0]);
    for (var i = 0; i < scenarios.length; i++) {
      if (scenarios[i]["referenceIndex"] && scenarioInPopup[0] == scenarios[i]["referenceIndex"]) simulate(i);
    }
    graph();
  }

  function graph() {
    var numDisplayed = 0;
    if (netWorthsArray != null && netWorthsArray[0] != null) {
      for (var i = 0; i < netWorthsArray.length; i++) {
        if (scenarios[i].hidden) continue;
        if (data.datasets.length <= numDisplayed) data.datasets.push({
          label: netWorthsArray[i][0],
          data: [],
          backgroundColor: netWorthsArray[i][1],
          pointRadius: 1
          // backgroundColor: graphColors[i%graphColors.length]
        })
        data.datasets[numDisplayed].data = netWorthsArray[i][2].map(([date, money]) => [new Date(date).getTime(),money])
        numDisplayed++
        console.log(i, numDisplayed)
      }

      config.data = data;

      const element = document.getElementById('test')
      if (element && element instanceof HTMLCanvasElement) {
        if (chart && chart.current) chart.current.destroy();
        chart.current = new Chart(
          element,
          config
        );
      }
    }
  }

  function fitDataContinuousCompoundingWithRegularContributions(data: [string, number][]): { P: number; r: number; C: number } {
    // Convert date strings to time (in years) relative to the first date.
    const tValues: number[] = [];
    const yValues: number[] = [];
    const startDate = new Date(data[0][0]);
    for (const [dateStr, y] of data) {
      const date = new Date(dateStr);
      const t =
        (date.getTime() - startDate.getTime()) /
        (365.25 * 24 * 3600 * 1000);
      tValues.push(t);
      yValues.push(y);
    }
  
    // Define the model: f(t) = P*exp(r*t) + (C/r)*(exp(r*t)-1)
    function model(t: number, P: number, r: number, C: number): number {
      return P * Math.exp(r * t) + (C / r) * (Math.exp(r * t) - 1);
    }
  
    // Initial guesses for parameters.
    // let P = yValues[0]; // starting value from first data point
    let P = 80000
    let r = 0.03;
    let C = 200000
  
    // Gradient descent settings.
    let learningRate = 1e-2;
    const maxIterations = 100000;
    const tolerance = 1e-6;
    let previousError = Infinity;

    // Iterative gradient descent.
    for (let iter = 0; iter < maxIterations; iter++) {
      let error = 0;
      let gradP = 0;
      let gradR = 0;
      let gradC = 0;

      // if (logAmount > 0 && iter%logLevel == 0)
      //   console.log(`Before: error: ${error}, gradP: ${gradP}, gradR: ${gradR}, gradC: ${gradC}, P: ${P}, r: ${r}, c: ${C}`)
  
      for (let i = 0; i < tValues.length; i++) {
        const t = tValues[i];
        const y = yValues[i];
        const exp_rt = Math.exp(r * t);
        // Compute the model output.
        const f = P * exp_rt + (C / r) * (exp_rt - 1);
        const diff = f - y;
        error += diff * diff;
  
        // Compute partial derivatives.
        const dfdP = exp_rt;
        // d/dr [P*exp(r*t)] = P*t*exp(r*t)
        // d/dr [(C/r)*(exp(r*t)-1)] = -C*(exp(r*t)-1)/r**2 + (C*t*exp(r*t))/r
        const dfdR =
          P * t * exp_rt +
          (C * t * exp_rt) / r -
          (C * (exp_rt - 1)) / (r * r);
        // d/dC [(C/r)*(exp(r*t)-1)] = (exp(r*t)-1)/r
        const dfdC = (exp_rt - 1) / r;

        // if (logAmount > 0 && iter%logLevel == 0) {
        //   console.log("diff: ", diff, ", dfdR: ", dfdR)
        // }
  
        gradP += 2 * diff * dfdP;
        gradR += 2 * diff * dfdR;
        gradC += 2 * diff * dfdC;
      }
  
      // Check for convergence.
      if (Math.abs(previousError - error) < tolerance) {
        break;
      }
      previousError = error;
  
      const n = tValues.length;
      let deltaP = (learningRate * gradP) / n;
      let deltaR = (learningRate * gradR) / n;
      let deltaC = (learningRate * gradC) / n;

      // Clip the update for r so it doesn't become enormous.
      const maxDeltaPercent = 0.1; // adjust this bound as needed
      if (Math.abs(deltaP/P) > maxDeltaPercent) deltaP = Math.sign(deltaP) * maxDeltaPercent * Math.abs(P);
      if (Math.abs(deltaR/r) > maxDeltaPercent) deltaR = Math.sign(deltaR) * maxDeltaPercent * Math.abs(r);
      if (Math.abs(deltaC/C) > maxDeltaPercent) deltaC = Math.sign(deltaC) * maxDeltaPercent * Math.abs(C);

      // if (logAmount > 0 && iter%logLevel == 0) {
      //   console.log(`After: error: ${error}, gradP: ${deltaP}, gradR: ${deltaR}, gradC: ${deltaC}, P: ${P}, r: ${r}, c: ${C}`)
      //   logAmount--;
      // }

      // Update the parameters.
      P -= deltaP;
      r -= deltaR;
      C -= deltaC;
  
      // Prevent r from being too close to zero (avoid division issues).
      if (Math.abs(r) < 1e-8) {
        r = 1e-8 * (r < 0 ? -1 : 1);
      }
    }

    console.log(tValues[0], tValues[tValues.length-1])
  
    return { P, r, C };
  }

  useEffect(() => {
    for(let i = 0; i < scenarios.length; i++) simulate(i);
    toSimulate = false;
    graph();
  }, [])

  return (
    <>
      <div className="scenarios">
        <div className="scenario_header">
          Scenarios
          <div className="saveLoadContainer">
            <button className="loadScenarios" onClick={(e) => document.getElementById("loadScenarios-input")?.click()}><FaUpload /></button>
            <input id="loadScenarios-input" type="file" name="name" onChange={(e) => {console.log("ANYTHING??"); loadScenarios(e)} }/>
            <button className="saveScenarios" onClick={(e) => saveFile(new Blob([JSON.stringify(scenarios, null, 2)], {type : "application/json"}))}><FaSave /></button>
          </div>
        </div>
        {scenarios.map((scenario, i) => 
        <div className="scenario">
          <div className={"scenario_name"+(scenario["hidden"] ? "_strikethrough" : "")}>{scenario["name"]}</div> 
          <div>
            <button className="scenario_hide_unhide" onClick={(e) => setScenarios(scenarios.map((scen, ind) => ind == i ? {...scen, hidden: !scen.hidden} : scen))}><BiSolidHide /></button>
            <button className="scenario_expand" onClick={(e) => setScenarioInPopup([i, scenario])}><FaRegEdit /></button>
          </div>
        </div>)}
        {scenarioInPopup &&
        <div className="scenario_popup">
          <div className="scenario_popup_header">
            <div className="scenario_popup_name">{scenarioInPopup[1]["name"]}</div>
            <button className="scenario_popup_close" onClick={(e) => setScenarioInPopup(null)}>X</button>
          </div>
          {scenarioInPopup[1]["type"] == 'sources' && scenarioInPopup[1]["sources"].map((source, i) =>
            <div className="source">
              <div className="source_nameRow">
                <p className="source_sourceName">{source["name"]}</p>
                <div className="source_editSourceButton" onClick={(e) => setSourceInPopup(source)}> edit </div>
              </div>
            </div>
          )}
          {scenarioInPopup[1]["type"] == 'data' &&
            <div className="source">
              <div className="source_nameRow">
                <p className="source_sourceName">{"Data"}</p>
                <div className="source_editSourceButton" onClick={(e) => setSourceInPopup({"data": scenarioInPopup[1]["data"]})}> edit </div>
              </div>
            </div>
          }
          {scenarioInPopup[1]["type"] == 'fit' &&
            <div className="source">
              <div className="source_nameRow">
                <p className="source_sourceName">{"Properties"}</p>
                <div className="source_editSourceButton" onClick={(e) => setSourceInPopup({
                  "referenceIndex": scenarioInPopup[1]["referenceIndex"],
                  "fitType": scenarioInPopup[1]["fitType"]})}> edit </div>
              </div>
            </div>
          }
          {sourceInPopup &&
          <div className="source_popup">
            <div className="source_popup_header">
              <div className="source_popup_name"> {sourceInPopup["name"]} </div>
              <button className="source_popup_close" onClick={(e) => setSourceInPopup(null)}>X</button>
            </div>
            <pre contentEditable="true" onBlur={(event) => onUpdate(event)}> {JSON.stringify(sourceInPopup, null, 2)} </pre>
          </div>
          }
        </div>
        }
      </div>
      <div className="graph">
        <div className="graph_body"></div>
        <div className="graph_graph"><canvas id="test"></canvas></div>
      </div>
    </>
  )
  
}

export default App
