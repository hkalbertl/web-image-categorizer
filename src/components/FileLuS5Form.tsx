import { useImperativeHandle, forwardRef, useState } from "react";
import { useTranslation, Trans } from 'react-i18next';
import { Col, Form, Row } from "react-bootstrap";
import { WICProvider } from "@/types/common";

export type FileLuS5FormRef = {
  validate: () => WICProvider | undefined;
  setValues: (accessId: string, secretKey: string) => void;
};

export const FileLuS5Form = forwardRef<FileLuS5FormRef>((props, ref) => {

  const { t } = useTranslation();

  const [accessId, setAccessId] = useState("");
  const [secretKey, setSecretKey] = useState("");

  const [accessIdError, setAccessIdError] = useState<string | undefined>();
  const [secretKeyError, setSecretKeyError] = useState<string | undefined>();

  const resetForm = (excludeInput: boolean = false) => {
    if (!excludeInput) {
      setAccessId('');
      setSecretKey('');
    }
    setAccessIdError(undefined);
    setSecretKeyError(undefined);
  };

  useImperativeHandle(ref, () => ({
    validate: () => {
      let isValid = true;
      resetForm(true);

      if (!accessId) {
        setAccessIdError(t("fieldRequired"));
        isValid = false;
      }
      if (!secretKey) {
        setSecretKeyError(t("fieldRequired"));
        isValid = false;
      }

      if (isValid) {
        return { type: 'FileLuS5', accessId, secretKey };
      }
      return undefined;
    },
    setValues: (accessId: string, secretKey: string) => {
      setAccessId(accessId);
      setSecretKey(secretKey);
    },
  }));

  return (<>
    <Form.Group as={Row} controlId="filelu-s5-access-id">
      <Form.Label column sm={3}>{t("s5AccessId")}</Form.Label>
      <Col sm={9}>
        <Form.Control type="text" maxLength={50} isInvalid={!!accessIdError}
          value={accessId} onInput={e => setAccessId(e.currentTarget.value)}
        />
        <Form.Control.Feedback type="invalid">
          {accessIdError}
        </Form.Control.Feedback>
      </Col>
    </Form.Group>
    <Form.Group as={Row} controlId="filelu-s5-secret-key">
      <Form.Label column sm={3}>{t("s5SecretKey")}</Form.Label>
      <Col sm={9}>
        <PasswordField password={secretKey} onInput={setSecretKey} invalidMsg={secretKeyError} />
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
