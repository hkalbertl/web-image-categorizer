import { useTranslation } from "react-i18next";
import { Button, Modal, Spinner } from "react-bootstrap";
import { CheckLg, ExclamationTriangle } from "react-bootstrap-icons";
import { MessageModalMode } from "@/types/common";

interface MessageModalProps {
  mode: MessageModalMode,
  message?: string;
  onClose: () => void;
}

const MessageModal: React.FC<MessageModalProps> = ({ mode, message, onClose }) => {

  const { t } = useTranslation();

  return (
    <Modal backdrop="static" show={'hidden' !== mode} onHide={onClose} centered>
      {'progress' !== mode &&
        <Modal.Header closeButton>
          <Modal.Title>{t("appName")}</Modal.Title>
        </Modal.Header>
      }
      <Modal.Body className="d-flex align-items-center">
        <div className="pe-3">
          {'progress' === mode && <Spinner animation="border" variant="primary" />}
          {'success' === mode && <CheckLg className="text-success fs-3" />}
          {'failed' === mode && <ExclamationTriangle className="text-danger fs-3" />}
        </div>
        <div>{message}</div>
      </Modal.Body>
      {'progress' !== mode &&
        <Modal.Footer>
          <Button type="button" variant="primary" onClick={onClose}>
            {t("ok")}
          </Button>
        </Modal.Footer>
      }
    </Modal>
  );
};

export default MessageModal;
