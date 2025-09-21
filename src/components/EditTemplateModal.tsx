import { validateTemplateInput } from "@/utils/common";
import { WICTemplate } from "@/types/models";
import { Button, Form, InputGroup, Modal } from "react-bootstrap";
import { ClipboardPulse, Pencil, XLg } from "react-bootstrap-icons";
import UrlTesterModal from "./UrlTesterModal";
import ParamTesterModal from "./ParamTesterModal";
import { useTranslation } from "react-i18next";

interface EditTemplateModalProps {
  show: boolean;
  template?: WICTemplate; // if undefined → add mode
  onClose: () => void;
  onSave: (template: WICTemplate) => void;
}

const EditTemplateModal: React.FC<EditTemplateModalProps> = ({ show, template, onClose, onSave }) => {

  const { t } = useTranslation();

  const [url, setUrl] = useState("");
  const [directory, setDirectory] = useState("");
  const [fileName, setFileName] = useState("");
  const [encryption, setEncryption] = useState(false);

  const [urlError, setUrlError] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [fileNameError, setFileNameError] = useState<string | null>(null);

  const [showUrlTester, setShowUrlTester] = useState(false);
  const [showParamTester, setShowParamTester] = useState(false);
  const [paramTesterPattern, setParamTesterPattern] = useState("");
  const [paramTesterDirMode, setParamTesterDirMode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Reset validation
    let isValid = true;
    setUrlError(null);
    setDirectoryError(null);
    setFileNameError(null);

    // Read form values
    const record: WICTemplate = {
      url: url.trim(),
      directory: directory.trim(),
      fileName: fileName.trim(),
      encryption
    };

    if (!record.url) {
      setUrlError('URL Pattern is required.');
      isValid = false;
    }

    if (record.directory) {
      let itemError = validateTemplateInput(record.directory, true);
      if (itemError) {
        setDirectoryError(itemError);
        isValid = false;
      }
    }

    if (record.fileName) {
      let itemError = validateTemplateInput(record.fileName, false);
      if (itemError) {
        setFileNameError(itemError);
        isValid = false;
      }
    }

    if (isValid) {
      // Return record back to option page
      onSave(record);
    }

    return false;
  };

  const resetForm = () => {
    setUrl('');
    setDirectory('');
    setFileName('');
    setUrlError(null);
    setDirectoryError(null);
    setFileNameError(null);
    setEncryption(false);
  };

  const onModalOpen = () => {
    // Reset form
    resetForm();
    // Fill existing template record, if it is in edit mode
    if (template) {
      setUrl(template.url || '');
      setDirectory(template.directory || '');
      setFileName(template.fileName || '');
      setEncryption(template.encryption);
    }
  };

  const openUrlTester = () => {
    setShowUrlTester(true);
  };

  const onApplyUrlPattern = (pattern: string) => {
    setShowUrlTester(false);
    setUrl(pattern);
  }

  const openParamTester = (isDirMode: boolean) => {
    setParamTesterDirMode(isDirMode);
    setParamTesterPattern(isDirMode ? directory : fileName);
    setShowParamTester(true);
  };

  const onApplyParamPattern = (pattern: string, isDirMode: boolean) => {
    setShowParamTester(false);
    if (isDirMode) {
      setDirectory(pattern);
    } else {
      setFileName(pattern);
    }
  };

  return (<>
    <Modal show={show} onHide={onClose} backdrop="static" size="lg" onShow={onModalOpen}>
      <Modal.Header closeButton>
        <Modal.Title>Naming Template</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form id="url-template-form" autoComplete="off" noValidate onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="template-url-pattern">URL Pattern</Form.Label>
            <InputGroup>
              <Form.Control id="template-url-pattern" type="text" maxLength={500}
                className={urlError ? 'is-invalid' : ''} isInvalid={!!urlError}
                value={url} onInput={e => setUrl(e.currentTarget.value)}
              />
              <Button className="rounded-end no-text" variant="outline-secondary" onClick={openUrlTester}>
                <ClipboardPulse />
              </Button>
              <Form.Control.Feedback type="invalid">
                {urlError}
              </Form.Control.Feedback>
            </InputGroup>
            <Form.Text>
              The URL search pattern for matching web pages. The wildcard character <b>*</b> can be used. For example:
              <ul>
                <li>https://www.example1.com/*</li>
                <li>https://www.example2.com/photo/*</li>
                <li>https://www.example3.com/*/photo?id=*</li>
              </ul>
            </Form.Text>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="template-directory">Destination Directory Path</Form.Label>
            <InputGroup>
              <Form.Control id="template-directory" type="text" maxLength={500}
                className={directoryError ? 'is-invalid' : ''} isInvalid={!!directoryError}
                value={directory} onInput={e => setDirectory(e.currentTarget.value)}
              />
              <Button className="rounded-end no-text" variant="outline-secondary" onClick={() => openParamTester(true)}>
                <ClipboardPulse />
              </Button>
              <Form.Control.Feedback type="invalid">
                {directoryError}
              </Form.Control.Feedback>
            </InputGroup>
            <Form.Text>
              The full path to the directory on FileLu where the target image will be saved. <a
                href="https://github.com/hkalbertl/web-image-categorizer/wiki/Documentation#wic-parameters"
                target="_blank">WIC parameters</a> are supported. The path must start with the / character.
              For example:
              <ul className="mb-0">
                <li>/&#123;host&#125;</li>
                <li>/example1/&#123;now-YYYYMM&#125;</li>
                <li>/example2/img&#123;now-YYMM&#125;_&#123;path-1&#125;</li>
              </ul>
              Leave blank to save files to the <a
                href="https://github.com/hkalbertl/web-image-categorizer/wiki/Documentation#wic-fallback-location"
                target="_blank">fallback directory</a>.
            </Form.Text>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="template-file-name">File Name</Form.Label>
            <InputGroup>
              <Form.Control type="text" id="template-file-name" maxLength={200}
                className={fileNameError ? 'is-invalid' : ''} isInvalid={!!fileNameError}
                value={fileName} onInput={e => setFileName(e.currentTarget.value)}
              />
              <Button className="rounded-end no-text" variant="outline-secondary" onClick={() => openParamTester(false)}>
                <ClipboardPulse />
              </Button>
              <Form.Control.Feedback type="invalid">
                {fileNameError}
              </Form.Control.Feedback>
            </InputGroup>
            <Form.Text>
              The image file name template <b>without extension name</b>. <a
                href="https://github.com/hkalbertl/web-image-categorizer/wiki/Documentation#wic-parameters"
                target="_blank">WIC parameters</a> are supported.
              For example:
              <ul className="mb-0">
                <li>photo&#123;now&#125;</li>
                <li>&#123;now-MMDD&#125;&#123;path-2&#125;</li>
                <li>image_&#123;query-id&#125;</li>
              </ul>
              Leave blank to use <a
                href="https://github.com/hkalbertl/web-image-categorizer/wiki/Documentation#wic-fallback-location"
                target="_blank">fallback file name</a>.
            </Form.Text>
          </Form.Group>
          <Form.Check
            type="switch" id="template-use-encryption" label="Use client-side encryption when available"
            className="mb-3" checked={encryption} onChange={e => setEncryption(e.target.checked)}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer className="align-item-start">
        <Button variant="primary" type="submit" form="url-template-form">
          <Pencil />
          &nbsp;{t(template ? "edit" : "add")}
        </Button>
        <Button variant="outline-secondary" type="button" className="ms-auto" onClick={onClose}>
          <XLg />
          &nbsp;{t("cancel")}
        </Button>
      </Modal.Footer>
    </Modal>
    <UrlTesterModal
      show={showUrlTester}
      pattern={url}
      onUse={onApplyUrlPattern}
      onClose={() => setShowUrlTester(false)}
    />
    <ParamTesterModal
      show={showParamTester}
      pattern={paramTesterPattern}
      isDirMode={paramTesterDirMode}
      onUse={onApplyParamPattern}
      onClose={() => setShowParamTester(false)}
    />
  </>
  );
}

export default EditTemplateModal;
