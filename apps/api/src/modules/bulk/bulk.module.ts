import { Module } from '@nestjs/common';
import { createTenantRepositoryProviders } from '../../database/tenant-repository.providers';
import { CharterPartiesController } from './charter-parties/charter-parties.controller';
import { CharterPartiesService } from './charter-parties/charter-parties.service';
import { CounterpartiesController } from './counterparties/counterparties.controller';
import { CounterpartiesService } from './counterparties/counterparties.service';
import { BulkDisputesController } from './disputes/bulk-disputes.controller';
import { BulkDisputesService } from './disputes/bulk-disputes.service';
import { CalculationPeriod } from './entities/calculation-period.entity';
import { CharterParty } from './entities/charter-party.entity';
import { Counterparty } from './entities/counterparty.entity';
import { CpClause } from './entities/cp-clause.entity';
import { DisputeCaseBulk } from './entities/dispute-case-bulk.entity';
import { LaytimeCalculation } from './entities/laytime-calculation.entity';
import { NorDocument } from './entities/nor-document.entity';
import { NorTenderLocationEvidence } from './entities/nor-tender-location-evidence.entity';
import { SofDocument } from './entities/sof-document.entity';
import { SofEvent } from './entities/sof-event.entity';
import { Vessel } from './entities/vessel.entity';
import { VoyageCounterparty } from './entities/voyage-counterparty.entity';
import { Voyage } from './entities/voyage.entity';
import { LaytimeCalculationsController } from './laytime-calculations/laytime-calculations.controller';
import { LaytimeCalculationsService } from './laytime-calculations/laytime-calculations.service';
import { NorDocumentsController } from './nor-documents/nor-documents.controller';
import { NorDocumentsService } from './nor-documents/nor-documents.service';
import { NorTenderLocationEvidenceController } from './nor-tender-location-evidence/nor-tender-location-evidence.controller';
import { NorTenderLocationEvidenceService } from './nor-tender-location-evidence/nor-tender-location-evidence.service';
import { SofDocumentsController } from './sof-documents/sof-documents.controller';
import { SofDocumentsService } from './sof-documents/sof-documents.service';
import { VesselsController } from './vessels/vessels.controller';
import { VesselsService } from './vessels/vessels.service';
import { VoyagesController } from './voyages/voyages.controller';
import { VoyagesService } from './voyages/voyages.service';
import { TenantContextModule } from '../cross-cutting/tenant-context/tenant-context.module';
import { ContractExtractionsController } from './contract-extractions/contract-extractions.controller';
import { ContractExtractionsService } from './contract-extractions/contract-extractions.service';

const BULK_ENTITIES = [
  CalculationPeriod,
  CharterParty,
  Counterparty,
  CpClause,
  DisputeCaseBulk,
  LaytimeCalculation,
  NorDocument,
  NorTenderLocationEvidence,
  SofDocument,
  SofEvent,
  Vessel,
  VoyageCounterparty,
  Voyage,
] as const;

/**
 * Bulk / tramp shipping: vessels, voyages, charter parties, SOF and NOR
 * documents, the laytime engine, demurrage/despatch disputes, and counterparties.
 */
@Module({
  imports: [TenantContextModule],
  controllers: [
    VesselsController,
    VoyagesController,
    CharterPartiesController,
    SofDocumentsController,
    NorDocumentsController,
    NorTenderLocationEvidenceController,
    LaytimeCalculationsController,
    BulkDisputesController,
    CounterpartiesController,
    ContractExtractionsController,
  ],
  providers: [
    ...createTenantRepositoryProviders(BULK_ENTITIES),
    VesselsService,
    VoyagesService,
    CharterPartiesService,
    SofDocumentsService,
    NorDocumentsService,
    NorTenderLocationEvidenceService,
    LaytimeCalculationsService,
    BulkDisputesService,
    CounterpartiesService,
    ContractExtractionsService,
  ],
})
export class BulkModule {}
