import { useState, useEffect, useRef } from 'react';
import { useIpc } from '../hooks/use-ipc';

interface Props {
  connectionId: string;
  database: string;
  table: string;
  isActive?: boolean;
  refreshTrigger: number;
}

export default function SchemaDDL({ connectionId, database, table, isActive, refreshTrigger }: Props) {
  const ipc = useIpc();
  const [ddl, setDdl] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    if (!isActive && !loaded.current) return;
    loaded.current = true;
    ipc.schemaCreateTable(connectionId, database, table)
      .then((text: string) => setDdl(text))
      .catch(() => setDdl('-- Failed to load DDL'));
  }, [connectionId, database, table, refreshTrigger, isActive]);

  const handleCopy = () => {
    navigator.clipboard.writeText(ddl);
  };

  const highlighted = ddl
    .replace(/\b(CREATE TABLE|PRIMARY KEY|KEY|UNIQUE KEY|CONSTRAINT|FOREIGN KEY|REFERENCES|ENGINE|DEFAULT CHARSET|COLLATE|NOT NULL|NULL|AUTO_INCREMENT|DEFAULT|COMMENT|ON DELETE|ON UPDATE|CASCADE|SET NULL|RESTRICT|NO ACTION|UNSIGNED|CHARACTER SET)\b/gi,
      '<span style="color:#cc7832">$1</span>')
    .replace(/\b(int|bigint|smallint|tinyint|mediumint|varchar|char|text|mediumtext|longtext|blob|mediumblob|longblob|datetime|timestamp|date|time|decimal|float|double|enum|set|boolean|bit)\b/gi,
      '<span style="color:#6897bb">$1</span>')
    .replace(/'([^']*)'/g, '<span style="color:#a5c261">\'$1\'</span>');

  return (
    <div className="schema-ddl">
      <div className="schema-zone-toolbar">
        <span className="schema-zone-title">CREATE TABLE DDL</span>
        <div className="schema-zone-actions">
          <button className="btn btn-secondary" onClick={handleCopy}>📋 Copy</button>
        </div>
      </div>
      <div className="schema-ddl-content">
        <pre dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    </div>
  );
}
