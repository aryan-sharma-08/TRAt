// TRAt React & HTM Local UMD Bridge Exporter
const React = window.React;
const ReactDOM = window.ReactDOM;
const html = window.htm.bind(React.createElement);

export { React, ReactDOM, html };
export default html;
