import '../src/index.css';
import { BroLLMProvider } from '../src/BroLLMContext';

export default function MyApp({ Component, pageProps }) {
  return (
    <BroLLMProvider>
      <Component {...pageProps} />
    </BroLLMProvider>
  );
}
