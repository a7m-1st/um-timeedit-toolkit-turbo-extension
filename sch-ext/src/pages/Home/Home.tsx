import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import './Home.css'

const Home = () => {
  const [msg, setMsg] = useState("Visit cloud.timeedit.net");
  const [maxItemsToFetch, setMaxItemsToFetch] = useState(0);
  const [tabId, setTabId] = useState(0);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const [isOn, setIsOn] = useState(false); // Switch State
  const [isFetching, setIsFetching] = useState(false);
  const [isTimeEditPage, setIsTimeEditPage] = useState(false);
  const [progress, setProgress] = useState(0); // New state for progress

  useEffect(() => {
    // Check if the current tab is a TimeEdit page
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (tab?.url?.startsWith('https://cloud.timeedit.net/my_um/web/students/')) {
        setIsTimeEditPage(true);
        if (tab?.id) {
          setTabId(tab.id);
          const port = chrome.tabs.connect(tab.id, { name: "knocker" });
          portRef.current = port;

          port.onMessage.addListener((msg) => {
            setMsg(msg.count);
          });

          port.onDisconnect.addListener(() => {
            console.log("Disconnected");
            portRef.current = null;
          });
          return () => {
            port.disconnect();
            portRef.current = null;
          };
        }
      } else {
        setIsTimeEditPage(false);
        setMsg("This extension only works on TimeEdit pages.");
      }
    });

    // Load data from localStorage on component mount
    const storedIsOn = localStorage.getItem("isOn");
    const storedMaxItemsToFetch = localStorage.getItem("maxItemsToFetch");

    if (storedIsOn !== null) {
      setIsOn(storedIsOn === "true");
    }
    if (storedMaxItemsToFetch !== null) {
      setMaxItemsToFetch(parseInt(storedMaxItemsToFetch));
    }

    // Listen for progress updates from the content script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "PROGRESS_UPDATE") {
        setProgress(message.size);
      }
    });
  }, []);

  useEffect(() => {
    // Save data to localStorage whenever isOn or maxItemsToFetch changes
    localStorage.setItem("isOn", String(isOn));
    localStorage.setItem("maxItemsToFetch", String(maxItemsToFetch));
  }, [isOn, maxItemsToFetch]);

  const passMessage = async () => {
    if (maxItemsToFetch == 0 || maxItemsToFetch < 0) {
      setMsg("Please set a valid number for max Items To Fetch");
    }

    if (tabId) {
      setMsg("Fetching...")
      const response = await chrome.tabs.sendMessage(tabId, {
        action: "start",
        maxItemsToFetch: maxItemsToFetch,
        turboMode: isOn
      });
      setIsFetching(true);

      setMsg(response.response);
      if (String(response.response) === "Complete") {
        setIsFetching(false);
      }
    } else {
      setMsg("Not connected to content script");
      console.log("Not connected to content script");
    }
  };

  // Toggle Switch
  const toggleSwitch = () => {
    setIsOn(!isOn);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>UM TimeEdit Toolkit Turbo</h1>
      </header>
      <div className="content">
        {isTimeEditPage ? (
          <>
            <h3 className="message">{msg}</h3>
            {/* Display progress */}
            <h3>Progress: {progress} %</h3>
            <input
              type="number"
              value={maxItemsToFetch}
              onChange={(e) =>
                setMaxItemsToFetch(parseInt(e.currentTarget.value))
              }
              className="input"
              placeholder="Max Items To Fetch"
            />

            <button onClick={passMessage} className="button" disabled={isFetching}>
              {isFetching ? "Fetching..." : "Fetch Courses"}
            </button>
            <hr />
            <small className="footnote">
              Extension by <a href="https://github.com/a7m-1st" target="_blank">A. Awelkair</a>, <br/>
              Toolkit by <a href="https://github.com/damnitjoshua" target="_blank">Joshua</a>
            </small>

            {/* Toggle Switch */}
            <div className="switch-container">
              <label className="switch">
                <input type="checkbox" checked={isOn} onChange={toggleSwitch} />
                <span className="slider round"></span>
              </label>
              <span className="switch-label">Turbo Mode</span>
            </div>
          </>
        ) : (
          <>
            <h3 className="message">
              This extension only works on TimeEdit pages.
            </h3>
            <small className="footnote">
              Extension by <a href="https://github.com/a7m-1st" target="_blank">A. Awelkair</a>, <br/>
              Toolkit by <a href="https://github.com/damnitjoshua" target="_blank">Joshua</a>
            </small>
          </>
        )}
      </div>
    </div>
  );
};

export default Home;
