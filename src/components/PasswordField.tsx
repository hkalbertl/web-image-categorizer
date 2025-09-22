import { Button, Form, InputGroup } from "react-bootstrap";
import { Eye, EyeSlash } from "react-bootstrap-icons";
import { useTranslation } from "react-i18next";

interface PasswordFieldProps {
  maxLength?: number;
  password: string;
  invalidMsg?: string;
  onInput: (value: string) => void;
}

/**
 * The password input field with toggle button.
 */
const PasswordField: React.FC<PasswordFieldProps> = ({ maxLength, password, invalidMsg, onInput }) => {

  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <InputGroup>
      <Form.Control type={showPassword ? "text" : "password"} maxLength={maxLength ?? 50}
        isInvalid={!!invalidMsg} value={password} onInput={e => onInput(e.currentTarget.value)}
      />
      <Button variant="outline-secondary" className="rounded-end no-text" title={t("togglePassword")}
        onClick={() => setShowPassword(!showPassword)}>
        {showPassword ? <Eye /> : <EyeSlash />}
      </Button>
      <Form.Control.Feedback type="invalid">
        {invalidMsg}
      </Form.Control.Feedback>
    </InputGroup>
  );
}

export default PasswordField;
