import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { SofDocument } from './entities/sof-document.entity';
import { SofEvent } from './entities/sof-event.entity';
import { Vessel } from './entities/vessel.entity';
import { Voyage } from './entities/voyage.entity';
import { LaytimeCalculationsController } from './laytime-calculations/laytime-calculations.controller';
import { LaytimeCalculationsService } from './laytime-calculations/laytime-calculations.service';
import { NorDocumentsController } from './nor-documents/nor-documents.controller';
import { NorDocumentsService } from './nor-documents/nor-documents.service';
import { SofDocumentsController } from './sof-documents/sof-documents.controller';
import { SofDocumentsService } from './sof-documents/sof-documents.service';
import { VesselsController } from './vessels/vessels.controller';
import { VesselsService } from './vessels/vessels.service';
import { VoyagesController } from './voyages/voyages.controller';
import { VoyagesService } from './voyages/voyages.service';

/**
 * Bulk / tramp shipping: vessels, voyages, charter parties, SOF and NOR
 * documents, the laytime engine, demurrage/despatch disputes, and counterparties.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CalculationPeriod,
      CharterParty,
      Counterparty,
      CpClause,
      DisputeCaseBulk,
      LaytimeCalculation,
      NorDocument,
      SofDocument,
      SofEvent,
      Vessel,
      Voyage,
    ]),
  ],
  controllers: [
    VesselsController,
    VoyagesController,
    CharterPartiesController,
    SofDocumentsController,
    NorDocumentsController,
    LaytimeCalculationsController,
    BulkDisputesController,
    CounterpartiesController,
  ],
  providers: [
    VesselsService,
    VoyagesService,
    CharterPartiesService,
    SofDocumentsService,
    NorDocumentsService,
    LaytimeCalculationsService,
    BulkDisputesService,
    CounterpartiesService,
  ],
})
export class BulkModule {}
