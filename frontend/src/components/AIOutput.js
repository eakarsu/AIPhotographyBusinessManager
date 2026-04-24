import React from 'react';

function formatAIText(text) {
  if (!text) return '';
  // Convert markdown-like formatting to HTML
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^\- (.*$)/gm, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap consecutive <li> in <ul>
  formatted = formatted.replace(/(<li>.*?<\/li>(\s*<br\/>)?)+/g, (match) => {
    return '<ul>' + match.replace(/<br\/>/g, '') + '</ul>';
  });

  return '<p>' + formatted + '</p>';
}

export default function AIOutput({ response, model, tokens, loading, title }) {
  if (loading) {
    return (
      <div className="ai-output">
        <div className="ai-output-header">
          <div className="ai-icon">🤖</div>
          <h3>AI Processing...</h3>
        </div>
        <div className="loading">
          <div className="spinner"></div>
          <span>Generating AI response...</span>
        </div>
      </div>
    );
  }

  if (!response) return null;

  return (
    <div className="ai-output">
      <div className="ai-output-header">
        <div className="ai-icon">✨</div>
        <h3>{title || 'AI Analysis'}</h3>
        {model && <span className="model-tag">{model}</span>}
      </div>
      <div
        className="ai-output-body"
        dangerouslySetInnerHTML={{ __html: formatAIText(response) }}
      />
      {tokens && (
        <div className="ai-output-footer">
          <span>📊 Prompt: {tokens.prompt_tokens || 0} tokens</span>
          <span>📝 Response: {tokens.completion_tokens || 0} tokens</span>
        </div>
      )}
    </div>
  );
}
