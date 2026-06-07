import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

// Lazy-loaded (via dynamic import) so @react-pdf/renderer is code-split out of
// the main bundle — only the progress page pulls it in.

export interface CertificateProps {
  name: string;
  cohortLabel: string;
  date: string;
  sessions: number;
  quizzes: number;
}

const NAVY = '#00193c';
const NAVY2 = '#002d62';
const MUTED = '#475569';

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', padding: 28, fontFamily: 'Helvetica' },
  frame: { flex: 1, border: `2pt solid ${NAVY}`, borderRadius: 6, padding: 28, alignItems: 'center', justifyContent: 'center' },
  inner: { borderTop: `1pt solid #cbd5e1`, borderBottom: `1pt solid #cbd5e1`, paddingVertical: 30, width: '100%', alignItems: 'center' },
  kicker: { fontSize: 11, letterSpacing: 4, color: MUTED, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  title: { fontSize: 30, color: NAVY, marginTop: 10, fontFamily: 'Helvetica-Bold' },
  program: { fontSize: 13, color: NAVY2, marginTop: 6, fontFamily: 'Helvetica-Bold' },
  awarded: { fontSize: 11, color: MUTED, marginTop: 26 },
  name: { fontSize: 26, color: NAVY, marginTop: 8, fontFamily: 'Helvetica-Bold' },
  cohort: { fontSize: 12, color: MUTED, marginTop: 8 },
  statsRow: { flexDirection: 'row', marginTop: 24, gap: 40 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 18, color: NAVY, fontFamily: 'Helvetica-Bold' },
  statLabel: { fontSize: 8, color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 34 },
  sigBlock: { alignItems: 'center' },
  sigName: { fontSize: 12, color: NAVY, fontFamily: 'Helvetica-Bold' },
  sigLine: { fontSize: 8, color: MUTED, letterSpacing: 1, textTransform: 'uppercase', marginTop: 3 },
});

function CertificateDoc({ name, cohortLabel, date, sessions, quizzes }: CertificateProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <Text style={styles.kicker}>Certificate of Completion</Text>
          <View style={styles.inner}>
            <Text style={styles.title}>Zero to Hero AI Sessions</Text>
            <Text style={styles.program}>EduConnect · AI Masterclass</Text>
            <Text style={styles.awarded}>This certifies that</Text>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.cohort}>completed the 12-week program as a member of the {cohortLabel} cohort.</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}><Text style={styles.statNum}>{quizzes}</Text><Text style={styles.statLabel}>Quizzes completed</Text></View>
              <View style={styles.stat}><Text style={styles.statNum}>{sessions}</Text><Text style={styles.statLabel}>Sessions attended</Text></View>
            </View>
          </View>
          <View style={styles.footer}>
            <View style={styles.sigBlock}><Text style={styles.sigName}>{date}</Text><Text style={styles.sigLine}>Date</Text></View>
            <View style={styles.sigBlock}><Text style={styles.sigName}>Abdul Rafay</Text><Text style={styles.sigLine}>Instructor</Text></View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function generateCertificateBlob(props: CertificateProps): Promise<Blob> {
  return await pdf(<CertificateDoc {...props} />).toBlob();
}
