import './stil.css';
import { Booth } from './ablauf';

const wurzel = document.getElementById('booth');

if (wurzel) {
  const booth = new Booth(wurzel);
  void booth.starte();
}
