import { Alert, Button, Form, Modal } from "react-bootstrap";
import { CheckLg, ExclamationTriangle, ClipboardPulse, Send, XLg } from "react-bootstrap-icons";
import { useTranslation } from "react-i18next";
import { WICTemplate } from "@/types/models";
import { validateTemplateInput, matchTemplate, getErrorMessage } from "@/utils/common";

interface ParamTesterModalProps {
  show: boolean;
  pattern?: string;
  isDirMode: boolean;
  onClose: () => void;
  onUse: (pattern: string, isDirMode: boolean) => void;
}

/**
 * The modal used for testing WIC parameter pattern.
 */
const ParamTesterModal: React.FC<ParamTesterModalProps> = ({ show, pattern, isDirMode, onClose, onUse }) => {

  const { t } = useTranslation();

  const [testPattern, setTestPattern] = useState('');
  const [testUrl, setTestUrl] = useState('');

  const [testPatternError, setTestPatternError] = useState<string | null>(null);
  const [testUrlError, setTestUrlError] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);

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
      setTestPatternError(t("fieldRequired"));
      isValid = false;
    } else {
      const patternError = validateTemplateInput(testPattern, isDirMode);
      if (patternError) {
        setTestPatternError(patternError);
        isValid = false;
      }
    }
    if (!testUrl) {
      setTestUrlError(t("fieldRequired"));
      isValid = false;
    } else if (-1 === testUrl.search(/^https?\:\/\/[^\s]+/)) {
      setTestUrlError('Invalid URL format.');
      isValid = false;
    }

    // Check the pattern is matched when form is valid
    if (isValid) {
      let itemError: string | undefined;
      try {
        const queryPattern: WICTemplate = { url: '*', encryption: false };
        if (isDirMode) {
          queryPattern.directory = testPattern;
        } else {
          queryPattern.fileName = testPattern;
        }
        const matching = matchTemplate([queryPattern], testUrl, 'Sample-Page-Title', 'image/jpeg');
        if (matching && matching.isMatched) {
          // Data matched
          setSuccessMessage(isDirMode ? matching.directory : matching.fileName);
        } else {
          // Failed to match or required parameter does not exist
          itemError = 'Failed to match, please double check parameters defined in pattern.';
        }
      } catch (ex) {
        itemError = getErrorMessage(ex);
      }
      if (itemError) {
        // Show error alert
        setFailedMessage(itemError);
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

    setSuccessMessage(null);
    setFailedMessage(null);
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
        <Modal.Title>WIC Parameter Tester</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form id="param-test-form" autoComplete="off" noValidate onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="param-test-pattern">{t(isDirMode ? "directoryPattern" : "fileNamePattern")}</Form.Label>
            <Form.Control id="param-test-pattern" type="text" isInvalid={!!testPatternError}
              className={`rounded-end ${testPatternError ? 'is-invalid' : ''}`}
              value={testPattern} onInput={e => setTestPattern(e.currentTarget.value)}
            />
            <Form.Control.Feedback type="invalid">
              {testPatternError}
            </Form.Control.Feedback>
            <Form.Text>
              <a href="https://github.com/hkalbertl/web-image-categorizer/wiki/Documentation#wic-parameters"
                target="_blank">WIC parameters</a> are supported.
            </Form.Text>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="param-test-url">{t("sourceUrl")}</Form.Label>
            <Form.Control id="param-test-url" type="text" isInvalid={!!testUrlError}
              className={`rounded-end ${testUrlError ? 'is-invalid' : ''}`}
              value={testUrl} onInput={e => setTestUrl(e.currentTarget.value)}
            />
            <Form.Control.Feedback type="invalid">
              {testUrlError}
            </Form.Control.Feedback>
          </Form.Group>
          <Alert variant="success" show={!!successMessage}>
            <CheckLg />
            &nbsp;Result: {successMessage}
          </Alert>
          <Alert variant="danger" show={!!failedMessage}>
            <ExclamationTriangle />
            &nbsp;{failedMessage}
          </Alert>
        </Form>
      </Modal.Body>
      <Modal.Footer className="align-items-start">
        <Button type="submit" variant="success" form="param-test-form">
          <ClipboardPulse />
          {t("test")}
        </Button>
        <Button type="button" variant="outline-primary" onClick={() => onUse(testPattern, isDirMode)}>
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

export default ParamTesterModal;
