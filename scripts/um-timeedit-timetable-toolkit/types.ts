type html_details = {
  "":string;
  Activity: string;
  Faculty: string | "LEC";
  "Lecture Day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  Lecturer: string;
  Module: string;
  "Module Offering": string;
  "On Hour": string;
  Room: string;
}
type reservation = {
  id: string;
  html_details: html_details;
  additional_info: {"":string} | Object;
  columns: string[];
  enddate: string;
  endtime: string;
  startdate: string;
  starttime: string;
}
type courseEvents = {
  data: {
    reservations: reservation[];
    columnheaders: string;
  }
}

type resolvedObjects = {
  id: string;
  idOnly: string;
  type: string;
  name: string;
  details: Object;
  events?:reservation[] | null;
}

type reservationDetail = {
  reservation: any;
  details: html_details | {} | null
}

export {courseEvents, resolvedObjects, reservationDetail}