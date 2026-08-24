import { CalculationPeriod } from '../../modules/bulk/entities/calculation-period.entity';
import { CharterParty } from '../../modules/bulk/entities/charter-party.entity';
import { Counterparty } from '../../modules/bulk/entities/counterparty.entity';
import { CpClause } from '../../modules/bulk/entities/cp-clause.entity';
import { DisputeCaseBulk } from '../../modules/bulk/entities/dispute-case-bulk.entity';
import { LaytimeCalculation } from '../../modules/bulk/entities/laytime-calculation.entity';
import { NorDocument } from '../../modules/bulk/entities/nor-document.entity';
import { NorTenderLocationEvidence } from '../../modules/bulk/entities/nor-tender-location-evidence.entity';
import { SofDocument } from '../../modules/bulk/entities/sof-document.entity';
import { SofEvent } from '../../modules/bulk/entities/sof-event.entity';
import { Vessel } from '../../modules/bulk/entities/vessel.entity';
import { Voyage } from '../../modules/bulk/entities/voyage.entity';
import { VoyageCounterparty } from '../../modules/bulk/entities/voyage-counterparty.entity';

import { CarrierTariff } from '../../modules/container/entities/carrier-tariff.entity';
import { ContainerMilestone } from '../../modules/container/entities/container-milestone.entity';
import { Container } from '../../modules/container/entities/container.entity';
import { DdInvoiceLine } from '../../modules/container/entities/dd-invoice-line.entity';
import { DdInvoice } from '../../modules/container/entities/dd-invoice.entity';
import { DisputeCaseContainer } from '../../modules/container/entities/dispute-case-container.entity';
import { FreeTimeClock } from '../../modules/container/entities/free-time-clock.entity';
import { ShipmentContainer } from '../../modules/container/entities/shipment-container.entity';
import { Shipment } from '../../modules/container/entities/shipment.entity';

import { AiInteraction } from '../../modules/cross-cutting/entities/ai-interaction.entity';
import { AuditLog } from '../../modules/cross-cutting/entities/audit-log.entity';
import { FeedbackSignal } from '../../modules/cross-cutting/entities/feedback-signal.entity';
import { KnowledgeBaseChunk } from '../../modules/cross-cutting/entities/knowledge-base-chunk.entity';
import { Organization } from '../../modules/cross-cutting/entities/organization.entity';
import { User } from '../../modules/cross-cutting/entities/user.entity';

export const databaseEntities = [
  Vessel,
  Voyage,
  CharterParty,
  CpClause,
  SofDocument,
  SofEvent,
  NorDocument,
  NorTenderLocationEvidence,
  LaytimeCalculation,
  CalculationPeriod,
  DisputeCaseBulk,
  Counterparty,
  VoyageCounterparty,

  Container,
  Shipment,
  ShipmentContainer,
  ContainerMilestone,
  CarrierTariff,
  FreeTimeClock,
  DdInvoice,
  DdInvoiceLine,
  DisputeCaseContainer,

  User,
  Organization,
  AuditLog,
  AiInteraction,
  FeedbackSignal,
  KnowledgeBaseChunk,
] as const;
