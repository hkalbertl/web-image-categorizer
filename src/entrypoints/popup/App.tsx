import { ListGroup } from 'react-bootstrap';
import { Gear, QuestionCircle } from 'react-bootstrap-icons';
import { useTranslation } from "react-i18next";
import { configBsTheme } from '@/utils/common';

import '../../../node_modules/bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {

  const { t } = useTranslation();

  const showOptionPage = () => {
    browser.runtime.openOptionsPage().catch(error => {
      console.error('Error opening options page:', error);
    });
    // Close the popup
    window.close();
  };

  useEffect(() => {
    configBsTheme();
  }, []);

  return (
    <ListGroup>
      <ListGroup.Item variant="secondary" className="text-center">
        <img src="icon/32.png" width="24" alt={t("appName")} />
        {t("appShortName")}
      </ListGroup.Item>
      <ListGroup.Item action onClick={showOptionPage}>
        <Gear />
        {t("options")}
      </ListGroup.Item>
      <ListGroup.Item action href="https://github.com/hkalbertl/web-image-categorizer/wiki" target="_blank">
        <QuestionCircle />
        {t("help")}
      </ListGroup.Item>
    </ListGroup>
  );
}

export default App;
