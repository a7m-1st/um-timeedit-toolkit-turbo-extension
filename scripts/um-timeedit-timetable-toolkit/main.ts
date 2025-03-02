import { courseEvents, reservationDetail, resolvedObjects } from "./types";
async function getObjectDetails(baseUrl:string, objectId:string) {
  try {
    const detailsResponse = await fetch(`${baseUrl}objects/${objectId}/o.json?fr=t&types=15&sid=5&l=en_US`);
    if (!detailsResponse.ok) {
      return null;
    }
    return await detailsResponse.json();
  } catch (detailsError) {
    return null;
  }
}

async function getCourseEvents(baseUrl:string, courseId:string) {
  try {
    const response = await fetch(baseUrl + "ri.json?h=f&sid=3&p=0.m,12.n&objects=" + courseId + "&ox=0&types=0&fe=0&h2=f&l=en_EN");

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data || !data.reservations || !data.columnheaders) {
      console.error("Invalid data format received from TimeEdit API");
      return null;
    }

    // @ts-ignore
    const reservations = data.reservations.map(rese => ({
      ...rese,
      // @ts-ignore
      additional_info: data.columnheaders.reduce((obj, key, index) => {
        obj[key] = rese.columns[index];
        return obj;
      }, {})
    }));

    return { ...data, reservations };

  } catch (error) {
    // @ts-ignore
    console.error("Error fetching course events:", error.message);
    return null;
  }
}

async function getReservationDetailsHtml(baseUrl:string, reservationId:string) {
  try {
    const url = `${baseUrl}ri.html?h=f&sid=3&types=4&fe=0&h2=f&l=en_EN&id=${reservationId}&fr=t&step=0&ef=2&nocache=2`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch (error) {
    // @ts-ignore
    console.error(`Error fetching reservation details HTML for ID ${reservationId}:`, error.message);
    return null;
  }
}

async function parseReservationDetailsFromHtml(html: string) {
  if (!html) {
    return null;
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const details = {};
  const detailTable = doc.querySelector('.detailedResObjects');
  if (detailTable) {
    const rows = Array.from(detailTable.querySelectorAll('tr'));
    for (const row of rows) {
      const columnNameCell = row.querySelector('.columnname');
      const valueCell = row.querySelector('.pr');
      if (columnNameCell && valueCell) {
        // @ts-ignore
        const columnName = columnNameCell.textContent.trim();
        // @ts-ignore
        const value = valueCell.textContent.trim();
        // @ts-ignore
        details[columnName] = value;
      }
    }
  }
  return details;
}

async function processResolvedObject(
  resolvedObject:resolvedObjects,
  eventsCountForBatch: number):Promise<any> {
  const object = resolvedObject;
  if (object && object.idOnly) {
    const events:courseEvents["data"] = await getCourseEvents(baseUrl, object.idOnly);
    object.events = events ? events.reservations : null;
    if (object.events) {
      eventsCountForBatch = object.events.length;

      const reservationDetailPromises:Promise<any>[] = object.events.map(async (reservation) => {        
        const reservationHtml = await getReservationDetailsHtml(baseUrl, reservation.id);
        const reservationDetails = reservationHtml ? await parseReservationDetailsFromHtml(reservationHtml) : null;

        const result:reservationDetail = { reservation, details: reservationDetails };
        //::Pass by reference property of JS
        result.reservation.html_details = result.details;
        return;
      })
      
      return await Promise.all(reservationDetailPromises);
    }
  } else {
    object.events = null;
    throw new Error("Object idOnly is null");
  }
}

function reportProgress(size: number) {
  chrome.runtime.sendMessage({ type: "PROGRESS_UPDATE", size: size.toFixed(2) });
}

async function getAllObjects(baseUrl:string, maxItems = 29000) {
  let allObjects:resolvedObjects[] = [];
  let currentStart = 0;
  let totalObjects = null;
  const pageSize = 100;
  const objectsBaseUrl = `${baseUrl}objects.html?max=${pageSize}&fr=t&partajax=t&im=f&sid=4&l=en_US&objects=&types=15&part=t&media=html`;

  while (allObjects.length < maxItems) {
    let eventsCountForBatch = 0;
    const currentUrl = `${objectsBaseUrl}&start=${currentStart}`;
    try {
      const response = await fetch(currentUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // @ts-ignore
      const objectsOnPagePromises = Array.from(doc.querySelectorAll('[data-idonly]')).map(async itemDiv => {
        try {
          //Stop loop when max 
          //TODO: Somehow, maybe bcz length is of initial, this is not working
          if (allObjects.length >= maxItems) {
            throw new Error("Max Items Reached");
          }
          // @ts-ignore
          const objectId = itemDiv.dataset.idonly;
          // @ts-ignore
          const objectName = itemDiv.dataset.name;
          const details = await getObjectDetails(baseUrl, objectId);
          const result = {// @ts-ignore
            id: itemDiv.dataset.id,// @ts-ignore
            idOnly: itemDiv.dataset.idonly,// @ts-ignore
            type: itemDiv.dataset.type,
            name: objectName,
            events: null,
            details: details,
          };
  
          await processResolvedObject(result, eventsCountForBatch);
          //::Pass by reference property of JS | Modified result
          if(allObjects.length < maxItems) {
            allObjects.push(result);
            console.log(`Progress: ${allObjects.length}/${maxItems}`);
            reportProgress((allObjects.length/maxItems)*100)
          }
        } catch (error:any) {
          if (error.message === "Max Items Reached") {
            return allObjects; // We've reached our maximum
          }
          console.error("Error processing object:", error);
        }
      });
      
      if(objectsOnPagePromises.length !== 0) {
        //Array of objects
        const resolvedObjects: PromiseSettledResult<any>[] = await Promise.allSettled(objectsOnPagePromises);
        
        const totalObjectsElement = doc.querySelector('.searchResultCount');
        let totalObjects = null;
        if (totalObjectsElement) {// @ts-ignore
          const countText = totalObjectsElement.textContent.trim().replace(/\D/g, '');
          totalObjects = parseInt(countText, 10);
        }
        const startIndex = currentStart + 1;
        const endIndex = currentStart + resolvedObjects.length;

        console.log(`Objects ${startIndex}-${endIndex} processed. Events found for e ${eventsCountForBatch} objects.`);

        if (totalObjects !== null && allObjects.length >= Math.min(totalObjects, maxItems)) {
          break;
        }
  
        if (resolvedObjects.length === 0) {
          break;
        }

        currentStart += pageSize;
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      break;
    }
  }
    
  return allObjects.slice(0, maxItems);
}

async function getAllObjectsTurbo(baseUrl:string, maxItems = 29000) {
  const pageSize = 100;
  const objectsBaseUrl = `${baseUrl}objects.html?max=${pageSize}&fr=t&partajax=t&im=f&sid=4&l=en_US&objects=&types=15&part=t&media=html`;
  let allObjects:resolvedObjects[] = [];
  
  const batchCount = Math.ceil(maxItems / pageSize);
  const batchPromises = [];

  for (let i = 0; i < batchCount; i++) {
    const currentStart = i * pageSize;
    
    const batchPromise = (async () => {
      //Every 100
        let eventsCountForBatch = 0;
        const currentUrl = `${objectsBaseUrl}&start=${currentStart}`;
        try {
          const response = await fetch(currentUrl);
          if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            return [];
          }
  
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          // @ts-ignore
          const objectsOnPagePromises = Array.from(doc.querySelectorAll('[data-idonly]')).map(async itemDiv => {
            try {
              //Stop loop when max 
              //TODO: Somehow, maybe bcz length is of initial, this is not working
              if (allObjects.length >= maxItems) {
                throw new Error("Max Items Reached");
              }
              // @ts-ignore
              const objectId = itemDiv.dataset.idonly;
              // @ts-ignore
              const objectName = itemDiv.dataset.name;
              const details = await getObjectDetails(baseUrl, objectId);
              const result = {// @ts-ignore
                id: itemDiv.dataset.id,// @ts-ignore
                idOnly: itemDiv.dataset.idonly,// @ts-ignore
                type: itemDiv.dataset.type,
                name: objectName,
                events: null,
                details: details,
              };
      
              await processResolvedObject(result, eventsCountForBatch);
              //::Pass by reference property of JS | Modified result
              if(allObjects.length < maxItems) {
                allObjects.push(result);
                console.log(`Progress: ${allObjects.length}/${maxItems}`);
                reportProgress((allObjects.length/maxItems)*100)
              }
            } catch (error:any) {
              if (error.message === "Max Items Reached") {
                return allObjects; // We've reached our maximum
              }
              console.error("Error processing object:", error);
            }
          });
          
          if(objectsOnPagePromises.length !== 0) {
            //Array of objects
            const resolvedObjects: PromiseSettledResult<any>[] = await Promise.allSettled(objectsOnPagePromises);
            
            const totalObjectsElement = doc.querySelector('.searchResultCount');
            let totalObjects = null;
            if (totalObjectsElement) {// @ts-ignore
              const countText = totalObjectsElement.textContent.trim().replace(/\D/g, '');
              totalObjects = parseInt(countText, 10);
            }
            const startIndex = currentStart + 1;
            const endIndex = currentStart + resolvedObjects.length;
            console.log(`Objects ${startIndex}-${endIndex} processed. Events found for e ${eventsCountForBatch} objects.`);
            if (totalObjects !== null && allObjects.length >= Math.min(totalObjects, maxItems)) 
              return [];
          } else return [];
        } catch (error) {
          console.error(`Error fetching batch starting at ${currentStart}:`, error);
          return [];
        }

    })();

    batchPromises.push(batchPromise);
  }

  await Promise.all(batchPromises);
  return allObjects.slice(0, maxItems);
}


let baseUrl = "https://cloud.timeedit.net/my_um/web/students/";
if (baseUrl[baseUrl.length - 1] !== "/") {
  baseUrl += "/";
}

const maxItemsToFetch = 29000; // <---- SET YOUR MAX ITEMS HERE
const fileName = 'course_events_with_details.json';

function startProcess(maxItemsToFetch:number, turbo:boolean):string {
  try {
    if(turbo) {
      getAllObjectsTurbo(baseUrl, maxItemsToFetch)
      .then(objectsWithEvents => {
        const blob = new Blob([JSON.stringify(objectsWithEvents, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    } else {
      getAllObjects(baseUrl, maxItemsToFetch)
        .then(objectsWithEvents => {
          const blob = new Blob([JSON.stringify(objectsWithEvents, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
    }
      
      // Return filename if no error is detected
      return fileName;
  } catch (error) {
    console.log("Error caught at main.js:startProcess()")
    return "";
  }
}

export {startProcess};