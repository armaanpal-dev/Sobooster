import { useMemo, useState } from 'react';
import { buildSynonymMap, expandQuery } from '../lib/search';
import type { PageProps } from './AdminApp';
import { Button, Card, Select, TextField } from './ui';

export function SynonymsPage({ config, update }: PageProps) {
  const [terms, setTerms] = useState('');
  const [oneWay, setOneWay] = useState<'two' | 'one'>('two');
  const [test, setTest] = useState('');
  const rules = config.synonyms;

  const parsed = terms.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const add = () => {
    if (parsed.length < 2) return;
    const id = `rule-${Date.now().toString(36)}`;
    update((c) => ({ ...c, synonyms: [...c.synonyms, { id, terms: [...new Set(parsed)], oneWay: oneWay === 'one' }] }));
    setTerms('');
  };

  const expansion = useMemo(() => expandQuery(test, buildSynonymMap(rules)), [test, rules]);

  return (
    <>
      <h1>Synonyms</h1>
      <p className="sb-admin__lead">
        Teach search the words your shoppers use. With “sweater, jumper, pullover”, a search for any of them finds all three.
      </p>

      <Card title="Add synonyms">
        <div className="sb-admin__grid">
          <TextField label="Terms" value={terms} placeholder="sweater, jumper, pullover" help="Comma-separated. Phrases work too." onChange={setTerms} />
          <Select
            label="Type"
            value={oneWay}
            options={[
              { value: 'two', label: 'Two-way: all terms are equal' },
              { value: 'one', label: 'One-way: first term also finds the others' },
            ]}
            onChange={setOneWay}
          />
        </div>
        <div className="sb-admin__row">
          <Button variant="primary" onClick={add} disabled={parsed.length < 2}>
            Add
          </Button>
        </div>
      </Card>

      <Card title={`Rules (${rules.length})`}>
        {rules.length === 0 ? (
          <p className="sb-admin__muted">No synonyms yet.</p>
        ) : (
          <ul className="sb-admin__rules">
            {rules.map((rule) => (
              <li key={rule.id}>
                <span className="sb-admin__rule-terms">
                  {rule.oneWay ? (
                    <>
                      <strong>{rule.terms[0]}</strong> → {rule.terms.slice(1).join(', ')}
                    </>
                  ) : (
                    rule.terms.join(' ⇄ ')
                  )}
                </span>
                <div className="sb-admin__row">
                  <Button
                    variant="plain"
                    onClick={() =>
                      update((c) => ({ ...c, synonyms: c.synonyms.map((r) => (r.id === rule.id ? { ...r, oneWay: !r.oneWay } : r)) }))
                    }
                  >
                    {rule.oneWay ? 'Make two-way' : 'Make one-way'}
                  </Button>
                  <Button
                    variant="critical"
                    label={`Delete ${rule.terms.join(', ')}`}
                    onClick={() => update((c) => ({ ...c, synonyms: c.synonyms.filter((r) => r.id !== rule.id) }))}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Try it" description="See how a search is expanded with your current rules (including unsaved ones).">
        <TextField label="Search" value={test} placeholder="jumper" onChange={setTest} />
        {expansion.length > 0 && (
          <p className="sb-admin__muted">
            Finds products matching{' '}
            {expansion.map((group, i) => (
              <span key={i}>
                {i > 0 && ' and '}
                <strong>{group.join(' or ')}</strong>
              </span>
            ))}
          </p>
        )}
      </Card>
    </>
  );
}
