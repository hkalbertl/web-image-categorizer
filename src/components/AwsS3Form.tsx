import { useImperativeHandle, forwardRef, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Col, Form, FormGroup, InputGroup, Row } from "react-bootstrap";
import { WICProvider } from "@/types/common";

export type AwsS3FormRef = {
  validate: () => WICProvider | undefined;
  setValues: (hostName: string, region: string, accessId: string, secretKey: string) => void;
};

export const AwsS3Form = forwardRef<AwsS3FormRef>((props, ref) => {

  const { t } = useTranslation();

  const [hostName, setHostName] = useState("");
  const [region, setRegion] = useState("");
  const [accessId, setAccessId] = useState("");
  const [secretKey, setSecretKey] = useState("");

  const [hostNameError, setHostNameError] = useState<string | undefined>();
  const [accessIdError, setAccessIdError] = useState<string | undefined>();
  const [secretKeyError, setSecretKeyError] = useState<string | undefined>();

  const resetForm = (excludeInput: boolean = false) => {
    if (!excludeInput) {
      setHostName('');
      setRegion('');
      setAccessId('');
      setSecretKey('');
    }
    setAccessIdError(undefined);
    setSecretKeyError(undefined);
    setHostNameError(undefined);
  };

  useImperativeHandle(ref, () => ({
    validate: () => {
      let isValid = true;
      resetForm(true);

      if (!hostName) {
        setHostNameError(t("fieldRequired"));
        isValid = false;
      }
      if (!accessId) {
        setAccessIdError(t("fieldRequired"));
        isValid = false;
      }
      if (!secretKey) {
        setSecretKeyError(t("fieldRequired"));
        isValid = false;
      }

      if (isValid) {
        return { type: 'AwsS3', hostName, region, accessId, secretKey };
      }
      return undefined;
    },
    setValues: (hostName: string, region: string, accessId: string, secretKey: string) => {
      setHostName(hostName);
      setRegion(region);
      setAccessId(accessId);
      setSecretKey(secretKey);
    },
  }));

  return (<>
    <Form.Group as={Row} controlId="aws-s3-host-name">
      <Form.Label column sm={3}>{t("hostName")}</Form.Label>
      <Col sm={9}>
        <InputGroup>
          <InputGroup.Text>https://</InputGroup.Text>
          <Form.Control type="text" className="rounded-end" maxLength={100} isInvalid={!!hostNameError}
            value={hostName} onInput={e => setHostName(e.currentTarget.value)}
          />
          <Form.Control.Feedback type="invalid">
            {hostNameError}
          </Form.Control.Feedback>
        </InputGroup>
      </Col>
    </Form.Group>
    <Form.Group as={Row} controlId="aws-s3-region">
      <Form.Label column sm={3}>{t("region")}</Form.Label>
      <Col sm={9}>
        <Form.Control type="text" maxLength={50} placeholder={t("optional")}
          value={region} onInput={e => setRegion(e.currentTarget.value)}
        />
        <Form.Text>{t("regionHelpText")}</Form.Text>
      </Col>
    </Form.Group>
    <Form.Group as={Row} controlId="aws-s3-access-id">
      <Form.Label column sm={3}>{t("accessId")}</Form.Label>
      <Col sm={9}>
        <Form.Control type="text" maxLength={50} isInvalid={!!accessIdError}
          value={accessId} onInput={e => setAccessId(e.currentTarget.value)}
        />
        <Form.Control.Feedback type="invalid">
          {accessIdError}
        </Form.Control.Feedback>
      </Col>
    </Form.Group>
    <Form.Group as={Row} controlId="aws-s3-secret-key">
      <Form.Label column sm={3}>{t("secretKey")}</Form.Label>
      <Col sm={9}>
        <PasswordField password={secretKey} onInput={setSecretKey} invalidMsg={secretKeyError} />
      </Col>
    </Form.Group>
  </>);
});
