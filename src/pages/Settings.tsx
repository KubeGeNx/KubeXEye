import React, { useState } from 'react';
import {
  PageSection,
  Form,
  FormGroup,
  TextInput,
  Button,
  Alert,
  Card,
  CardBody,
} from '@patternfly/react-core';
import { useConnection } from '../context/ConnectionContext';
import { useNodes } from '../hooks/useK8sResources';
import { PageTitle } from '../components/PageTitle';
import { NAV_ICONS } from '../components/layout/navIcons';

export const Settings: React.FC = () => {
  const { config, setConfig } = useConnection();
  const [apiBase, setApiBase] = useState(config.apiBase);
  const [token, setToken] = useState(config.token);
  const [saved, setSaved] = useState(false);

  const health = useNodes();

  return (
    <PageSection>
      <PageTitle icon={NAV_ICONS.settings}>Cluster Connection</PageTitle>

      <Card style={{ maxWidth: 640 }}>
        <CardBody>
          <Alert variant="info" isInline title="How this connects" style={{ marginBottom: '1rem' }}>
            By default the app talks to the Vite dev proxy at <code>/k8s-api</code>, which forwards to{' '}
            <code>kubectl proxy</code> (run <code>kubectl proxy --port=8001</code> before starting the dev
            server). To connect straight to an API server instead, set the base URL and a bearer token
            with read access to the resources you want to view.
          </Alert>

          <Form>
            <FormGroup label="API Base URL" fieldId="api-base">
              <TextInput
                id="api-base"
                value={apiBase}
                onChange={(_e, v) => setApiBase(v)}
                placeholder="/k8s-api or https://your-api-server:6443"
              />
            </FormGroup>
            <FormGroup label="Bearer Token (optional)" fieldId="token">
              <TextInput id="token" type="password" value={token} onChange={(_e, v) => setToken(v)} />
            </FormGroup>
            <Button
              variant="primary"
              onClick={() => {
                setConfig({ apiBase, token });
                setSaved(true);
              }}
            >
              Save
            </Button>
          </Form>

          {saved && (
            <Alert variant="success" isInline title="Saved" style={{ marginTop: '1rem' }}>
              Connection settings updated.
            </Alert>
          )}

          <div style={{ marginTop: '1rem' }}>
            {health.isLoading && <Alert variant="info" isInline title="Checking connection..." />}
            {health.error && (
              <Alert variant="danger" isInline title="Connection failed">
                {(health.error as Error).message}
              </Alert>
            )}
            {health.data && (
              <Alert variant="success" isInline title="Connected">
                Found {health.data.length} node(s).
              </Alert>
            )}
          </div>
        </CardBody>
      </Card>
    </PageSection>
  );
};
