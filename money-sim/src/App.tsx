import { Dispatch, useEffect, useState, useRef } from 'react'
import './App.css'
import exampleScenarios from './assets/scenarios.json'
import Chart, { ChartConfiguration, ChartConfigurationCustomTypesPerDataset, ChartTypeRegistry } from 'chart.js/auto'

type Scenario = {
  sources: {[key: string]: any}[];
  [key: string]: any;
}

function App() {
  const graphColors = ['rgb(255,99,132)', 'rgb(99,132,255)', 'rgb(132,255,99)'];
  const [count, setCount] = useState(0)
  const [scenarios, setScenarios] = useState<Scenario[]>(exampleScenarios);
  const [netWorthsArray, setNetWorthsArray] = useState<[string, number][][]>([]);
  const [scenarioInPopup, setScenarioInPopup] = useState<[number, Scenario]|null>(null);
  const [sourceInPopup, setSourceInPopup] = useState<{[key: string]: any}|null>(null);
  const chart = useRef<Chart | null>(null);
  const simulationYears = 10

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
    scenarios[scenarioIndex]["sources"].forEach(source => {
      netWorth += (source["type"] == "income" ? 0 : (source["type"] == "asset" ? 1 : -1))*source["value"]
    })

    let days_simulated = 365*simulationYears
    let today = new Date();

    let sources_copy: {[key: string]: any}[] = JSON.parse(JSON.stringify(scenarios[scenarioIndex]["sources"]))

    for(let i = 0; i < days_simulated; i++, today.setDate(today.getDate()+1)) {
      sources_copy.forEach(source => {
        let sourceType = source["type"];
        netWorth += sourceType == "income" ? source["value"]/365 : (sourceType == "asset" ? -source["value"] : source["value"])
        source["value"] *= Math.E**(source["interest_rate"]/365)
        netWorth += (sourceType == "income" ? 0 : (sourceType == "asset" ? 1 : -1)) * source["value"]
      })
      netWorths.push([String(today.toJSON().slice(0,10).replace(/-/g,'/')), netWorth])
    }

    while (netWorthsArray.length <= scenarioIndex) netWorthsArray.push([]);
    netWorthsArray[scenarioIndex] = netWorths;
  }

  function onUpdate(event: any): void {
    if (sourceInPopup == null || scenarioInPopup == null) return;
    const updatedContent = JSON.parse(event.target.innerText);

    // Update the properties of the existing object
    Object.keys(updatedContent).forEach(key => {
      sourceInPopup[key] = updatedContent[key];
    });

    // Optionally: Remove properties from thisAsObject that are not in updatedContent
    Object.keys(sourceInPopup).forEach(key => {
      if (!(key in updatedContent)) {
        delete sourceInPopup[key];
      }
    });

    simulate(scenarioInPopup[0]);
    graph();
  }

  function graph() {
    if (netWorthsArray != null && netWorthsArray[0] != null) {
      for (var i = 0; i < netWorthsArray.length; i++) {
        if (data.datasets.length <= i) data.datasets.push({
          label: scenarios[i]["name"],
          data: [],
          backgroundColor: graphColors[i%graphColors.length]
        })
        data.datasets[i].data = netWorthsArray[i].map(([date, money]) => [new Date(date).getTime(),money])
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

  useEffect(() => {
    for(let i = 0; i < scenarios.length; i++) simulate(i);
    graph();
  }, [])

  return (
    <>
      <div className="scenarios">
        <div className="scenario_header">Scenarios</div>
        {scenarios.map((scenario, i) => 
        <div className="scenario">
          <div className="scenario_name">{scenario["name"]}</div> 
          <button className="scenario_expand" onClick={(e) => setScenarioInPopup([i, scenario])}>+</button>
        </div>)}
        {scenarioInPopup &&
        <div className="scenario_popup">
          <div className="scenario_popup_header">
            <div className="scenario_popup_name">{scenarioInPopup[1]["name"]}</div>
            <button className="scenario_popup_close" onClick={(e) => setScenarioInPopup(null)}>X</button>
          </div>
          {scenarioInPopup[1]["sources"].map((source, i) =>
            <div className="source">
              <div className="source_nameRow">
                <p className="source_sourceName">{source["name"]}</p>
                <div className="source_editSourceButton" onClick={(e) => setSourceInPopup(source)}> edit </div>
              </div>
            </div>
          )}
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
