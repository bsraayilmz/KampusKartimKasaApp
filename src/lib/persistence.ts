import { browserLocalPersistence, type Persistence } from 'firebase/auth';

/** Web (önizleme): tarayıcının yerel depolaması. */
export const authPersistence = (): Persistence => browserLocalPersistence;
