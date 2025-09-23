import { useImperativeHandle, forwardRef, useState } from "react";
import { useTranslation, Trans } from 'react-i18next';
import { Col, Form, Row } from "react-bootstrap";
import { WICProvider } from "@/types/common";

export type FileLuFormRef = {
  validate: () => WICProvider | undefined;
  setValues: (apiKey: string) => void;
};

export const FileLuForm = forwardRef<FileLuFormRef>((props, ref) => {

  const { t } = useTranslation();

  const [apiKey, setApiKey] = useState("");

  const [apiKeyError, setApiKeyError] = useState<string | undefined>();

  const resetForm = (excludeInput: boolean = false) => {
    if (!excludeInput) {
      setApiKey('');
    }
    setApiKeyError(undefined);
  };

  useImperativeHandle(ref, () => ({
    validate: () => {
      let isValid = true;
      resetForm(true);

      if (!apiKey) {
        setApiKeyError(t("fieldRequired"));
        isValid = false;
      }

      if (isValid) {
        return { type: 'FileLu', apiKey };
      }
      return undefined;
    },
    setValues: (apiKey: string) => {
      setApiKey(apiKey);
    },
  }));

  return (<>
    <Form.Group as={Row} controlId="filelu-api-key">
      <Form.Label column sm={3}>{t("apiKey")}</Form.Label>
      <Col sm={9}>
        <PasswordField password={apiKey} onInput={setApiKey} invalidMsg={apiKeyError} />
        <Form.Text>
          <Trans
            i18nKey="enableFileLuApiKeyAtMyAccount"
            components={[<a href="https://filelu.com/account/" target="_blank" />]}
          />
        </Form.Text>
        <Form.Text>
          <Trans
            i18nKey="suggestFileLuReferral"
            components={[<a href="https://filelu.com/5155514948.html" target="_blank" />]}
          />
        </Form.Text>
      </Col>
    </Form.Group>
  </>);
});
