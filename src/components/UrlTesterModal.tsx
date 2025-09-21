import { Alert, Button, Form, Modal } from "react-bootstrap";
import { CheckLg, ExclamationTriangle, ClipboardPulse, Send, XLg } from "react-bootstrap-icons";
import { useTranslation } from "react-i18next";
import { isUrlMatch } from "@/utils/common";

interface UrlTesterModalProps {
  show: boolean;
  pattern?: string;
  onClose: () => void;
  onUse: (pattern: string) => void;
}

/**
 * The modal used for testing URL pattern.
 */
const UrlTesterModal: React.FC<UrlTesterModalProps> = ({ show, pattern, onClose, onUse }) => {

  const { t } = useTranslation();

  const [testPattern, setTestPattern] = useState('');
  const [testUrl, setTestUrl] = useState('');

  const [testPatternError, setTestPatternError] = useState<string | null>(null);
  const [testUrlError, setTestUrlError] = useState<string | null>(null);

  const [showSucces, setShowSucces] = useState(false);
  const [showFailed, setShowFailed] = useState(false);

  /**
   * Handle form submit, which is testing the input pattern.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetForm(true);

    // Validate form
    let isValid = true;
    if (!testPattern) {
      setTestPatternError('Required');
      isValid = false;
    }
    if (!testUrl) {
      setTestUrlError('Required');
      isValid = false;
    } else if (-1 === testUrl.search(/^https?\:\/\/[^\s]+/)) {
      setTestUrlError('Invalid URL format.');
      isValid = false;
    }

    // Check the pattern is matched when form is valid
    if (isValid) {
      if (isUrlMatch(testUrl, testPattern)) {
        setShowSucces(true);
      } else {
        setShowFailed(true);
      }
    }
    return false;
  };

  /**
   * Reset form, validation state and alerts.
   */
  const resetForm = (excludeTextbox: boolean = false) => {
    if (!excludeTextbox) {
      setTestPattern('');
      setTestUrl('');
    }
    setTestPatternError(null);
    setTestUrlError(null);
    setShowSucces(false);
    setShowFailed(false);
  };

  /**
   * Reset form and fill default values when modal opened.
   */
  const onModalOpen = () => {
    resetForm();
    if (pattern) {
      setTestPattern(pattern);
    }
  };

  return (<>
    <Modal className="modal-secondary" backdrop="static" show={show} onHide={onClose} onShow={onModalOpen} centered>
      <Modal.Header closeButton>
        <Modal.Title>URL Pattern Tester</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form id="url-test-form" autoComplete="off" noValidate onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="url-test-pattern">URL Pattern</Form.Label>
            <Form.Control id="url-test-pattern" type="text"
              className={testPatternError ? 'is-invalid' : ''} isInvalid={!!testPatternError}
              value={testPattern} onInput={e => setTestPattern(e.currentTarget.value)}
            />
            <Form.Control.Feedback type="invalid">
              {testPatternError}
            </Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="url-test-input">{t("sourceUrl")}</Form.Label>
            <Form.Control id="url-test-input" type="text"
              className={testUrlError ? 'is-invalid' : ''} isInvalid={!!testUrlError}
              value={testUrl} onInput={e => setTestUrl(e.currentTarget.value)}
            />
            <Form.Control.Feedback type="invalid">
              {testUrlError}
            </Form.Control.Feedback>
          </Form.Group>
          <Alert variant="success" show={showSucces}>
            <CheckLg />
            &nbsp;URL is matched.
          </Alert>
          <Alert variant="danger" show={showFailed}>
            <ExclamationTriangle />
            &nbsp;URL is not matched.
          </Alert>
        </Form>
      </Modal.Body>
      <Modal.Footer className="align-items-start">
        <Button type="submit" variant="success" form="url-test-form">
          <ClipboardPulse />
          {t("test")}
        </Button>
        <Button type="button" variant="outline-primary" onClick={() => onUse(testPattern)}>
          <Send />
          {t("use")}
        </Button>
        <Button type="button" variant="outline-secondary" className="ms-auto" onClick={onClose}>
          <XLg />
          {t("cancel")}
        </Button>
      </Modal.Footer>
    </Modal>
  </>);
};

export default UrlTesterModal;
