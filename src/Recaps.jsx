import React, { useEffect, useState } from "react";
import { api } from "./lib";
export default function Recaps({ date, revision }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api("/recaps")
      .then(setItems)
      .catch(() => {});
  }, [date, revision]);
  return items.length > 0 ? (
    <section className="panel">
      <h3>Your saved end-of-day recaps</h3>
      {items.map((r) => (
        <div className="recap" key={r.date}>
          <strong>{r.date}</strong>
          <p>{r.body}</p>
        </div>
      ))}
    </section>
  ) : null;
}
